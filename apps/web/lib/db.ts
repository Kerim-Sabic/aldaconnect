import { PGlite } from "@electric-sql/pglite";
import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { Actor } from "./domain";
import { cycleLocalSchema } from "./cycle-database";
import { medicationLocalSchema } from "./medication-database";
import { labLocalSchema } from "./lab-database";

const globalDb = globalThis as unknown as { fitnessDb?: Promise<PGlite> };
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
}
export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return (
    expected.length === derived.length && timingSafeEqual(expected, derived)
  );
}
export const tokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export const schema = `
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('client','trainer','doctor','nutritionist','therapist')),password_hash TEXT,onboarded BOOLEAN NOT NULL DEFAULT false,created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),expires_at TIMESTAMPTZ NOT NULL);
CREATE TABLE IF NOT EXISTS relationships(id TEXT PRIMARY KEY,expert_id TEXT REFERENCES users(id),client_id TEXT REFERENCES users(id),status TEXT NOT NULL DEFAULT 'active',UNIQUE(expert_id,client_id));
CREATE TABLE IF NOT EXISTS preferences(user_id TEXT PRIMARY KEY REFERENCES users(id),modules JSONB NOT NULL DEFAULT '["training","nutrition","progress","recovery"]',intake JSONB NOT NULL DEFAULT '{}',version INTEGER DEFAULT 1,updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS invitations(id TEXT PRIMARY KEY,token_hash TEXT UNIQUE,expert_id TEXT REFERENCES users(id),email TEXT NOT NULL,status TEXT DEFAULT 'pending',expires_at TIMESTAMPTZ NOT NULL);
CREATE TABLE IF NOT EXISTS plans(id TEXT PRIMARY KEY,client_id TEXT REFERENCES users(id),author_id TEXT REFERENCES users(id),title TEXT NOT NULL,version INTEGER NOT NULL,exercises JSONB NOT NULL,status TEXT DEFAULT 'published',reason TEXT,created_at TIMESTAMPTZ DEFAULT now(),UNIQUE(client_id,version));
CREATE TABLE IF NOT EXISTS workout_logs(id TEXT PRIMARY KEY,client_id TEXT REFERENCES users(id),plan_id TEXT REFERENCES plans(id),exercise_id TEXT NOT NULL,set_index INTEGER NOT NULL,weight NUMERIC NOT NULL,reps INTEGER NOT NULL,completed_at TIMESTAMPTZ DEFAULT now(),UNIQUE(client_id,plan_id,exercise_id,set_index));
CREATE TABLE IF NOT EXISTS checkins(id TEXT PRIMARY KEY,client_id TEXT REFERENCES users(id),energy INTEGER CHECK(energy BETWEEN 1 AND 5),sleep NUMERIC,note TEXT,status TEXT DEFAULT 'pending',review_note TEXT,created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS tasks(id TEXT PRIMARY KEY,owner_id TEXT REFERENCES users(id),client_id TEXT REFERENCES users(id),checkin_id TEXT REFERENCES checkins(id),kind TEXT NOT NULL,title TEXT NOT NULL,status TEXT DEFAULT 'open',created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS messages(id TEXT PRIMARY KEY,sender_id TEXT REFERENCES users(id),recipient_id TEXT REFERENCES users(id),body TEXT NOT NULL,created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS diary(id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),kind TEXT NOT NULL,label TEXT NOT NULL,value NUMERIC,created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS audit(id TEXT PRIMARY KEY,actor_id TEXT REFERENCES users(id),action TEXT NOT NULL,resource_id TEXT,created_at TIMESTAMPTZ DEFAULT now());
`;
export async function initialize(db: PGlite) {
  await db.exec(schema);
  await db.exec(cycleLocalSchema);
  await db.exec(medicationLocalSchema);
  await db.exec(labLocalSchema);
  await db.exec(`CREATE TABLE IF NOT EXISTS workout_sessions(id TEXT PRIMARY KEY,client_id TEXT REFERENCES users(id),plan_id TEXT REFERENCES plans(id),started_at TIMESTAMPTZ DEFAULT now(),completed_at TIMESTAMPTZ);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_workout ON workout_sessions(client_id) WHERE completed_at IS NULL;
ALTER TABLE workout_logs ALTER COLUMN reps DROP NOT NULL;
ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;
ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS session_id TEXT REFERENCES workout_sessions(id);
ALTER TABLE workout_logs DROP CONSTRAINT IF EXISTS workout_logs_client_id_plan_id_exercise_id_set_index_key;
CREATE UNIQUE INDEX IF NOT EXISTS session_sets ON workout_logs(session_id,exercise_id,set_index);`);
  await db.exec(
    "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS checkin_id TEXT REFERENCES checkins(id)",
  );
  await db.query(
    "UPDATE tasks SET checkin_id='checkin-sam' WHERE id='task-sam' AND checkin_id IS NULL",
  );
  const found = await db.query("SELECT id FROM users LIMIT 1");
  if (found.rows.length) {
    await db.query(
      "UPDATE users SET name=CASE id WHEN 'demo-client' THEN 'Amina Mehić' WHEN 'demo-trainer' THEN 'Jasmin Hadžić' WHEN 'demo-client-2' THEN 'Samir Alić' WHEN 'demo-client-3' THEN 'Mila Novak' ELSE name END WHERE id LIKE 'demo-%'",
    );
    const { exercises } = await import("./domain");
    await db.query(
      "UPDATE plans SET title='Donji dio tijela · Snaga i ravnoteža' WHERE client_id LIKE 'demo-%' AND title='Lower body · Build & balance'",
    );
    await db.query(
      "UPDATE plans SET exercises=$1,reason='Stabilan temelj. Kvalitet prije količine.' WHERE client_id LIKE 'demo-%' AND version=1",
      [JSON.stringify(exercises)],
    );
    await db.query(
      "UPDATE tasks SET title='Sedmični izvještaj je spreman za pregled' WHERE id='task-sam'",
    );
    await db.query(
      "UPDATE checkins SET note='Trening mi je prijao ove sedmice. Možemo li trening s petka pomjeriti na subotu?' WHERE id='checkin-sam'",
    );
    await db.query(
      "UPDATE messages SET body='Vaš plan je spreman. Danas se usmjerite na ugodna, kontrolisana ponavljanja. Javite mi kako je prošlo.' WHERE id='welcome'",
    );
    return db;
  }
  const { exercises } = await import("./domain");
  await db.transaction(async (tx) => {
    for (const u of [
      {
        id: "demo-client",
        email: "member@example.test",
        name: "Amina Mehić",
        role: "client",
      },
      {
        id: "demo-trainer",
        email: "coach@example.test",
        name: "Jasmin Hadžić",
        role: "trainer",
      },
      {
        id: "demo-client-2",
        email: "sam@example.test",
        name: "Samir Alić",
        role: "client",
      },
      {
        id: "demo-client-3",
        email: "mila@example.test",
        name: "Mila Novak",
        role: "client",
      },
    ]) {
      await tx.query(
        "INSERT INTO users(id,email,name,role,onboarded) VALUES($1,$2,$3,$4,true)",
        [u.id, u.email, u.name, u.role],
      );
      await tx.query("INSERT INTO preferences(user_id) VALUES($1)", [u.id]);
    }
    for (const id of ["demo-client", "demo-client-2", "demo-client-3"]) {
      await tx.query(
        "INSERT INTO relationships(id,expert_id,client_id) VALUES($1,$2,$3)",
        [crypto.randomUUID(), "demo-trainer", id],
      );
      await tx.query(
        "INSERT INTO plans(id,client_id,author_id,title,version,exercises,reason) VALUES($1,$2,$3,$4,1,$5,$6)",
        [
          "plan-" + id,
          id,
          "demo-trainer",
          "Donji dio tijela · Snaga i ravnoteža",
          JSON.stringify(exercises),
          "Stabilan temelj. Kvalitet prije količine.",
        ],
      );
    }
    await tx.query(
      "INSERT INTO checkins(id,client_id,energy,sleep,note) VALUES($1,$2,4,7.5,$3)",
      [
        "checkin-sam",
        "demo-client-2",
        "Trening mi je prijao ove sedmice. Možemo li trening s petka pomjeriti na subotu?",
      ],
    );
    await tx.query(
      "INSERT INTO tasks(id,owner_id,client_id,checkin_id,kind,title) VALUES($1,$2,$3,'checkin-sam',$4,$5)",
      [
        "task-sam",
        "demo-trainer",
        "demo-client-2",
        "checkin",
        "Sedmični izvještaj je spreman za pregled",
      ],
    );
    await tx.query(
      "INSERT INTO messages(id,sender_id,recipient_id,body) VALUES($1,$2,$3,$4)",
      [
        "welcome",
        "demo-trainer",
        "demo-client",
        "Vaš plan je spreman. Danas se usmjerite na ugodna, kontrolisana ponavljanja. Javite mi kako je prošlo.",
      ],
    );
  });
  return db;
}
export async function database() {
  if (!globalDb.fitnessDb)
    globalDb.fitnessDb = (async () => {
      const dir = path.resolve(process.cwd(), ".data/postgres");
      await mkdir(dir, { recursive: true });
      return initialize(new PGlite(dir));
    })();
  return globalDb.fitnessDb;
}
export async function getActor(
  db: PGlite,
  token: string,
): Promise<Actor | null> {
  const rows = await db.query<Actor>(
    `SELECT u.id,u.email,u.name,u.role,u.onboarded FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()`,
    [tokenHash(token)],
  );
  return rows.rows[0] ?? null;
}
export async function createSession(db: PGlite, userId: string) {
  const token = randomBytes(32).toString("hex");
  await db.query(
    `INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '12 hours')`,
    [tokenHash(token), userId],
  );
  return token;
}
