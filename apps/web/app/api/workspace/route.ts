import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import {
  database,
  getActor,
  createSession,
  hashPassword,
  verifyPassword,
  tokenHash,
} from "@/lib/db";
import {
  normalizeModules,
  canAccessClient,
  validateSet,
  isTimed,
  exercises,
} from "@/lib/domain";
import { cloudConfigured } from "@/lib/supabase/server";
import { cloudGet, cloudPost } from "@/lib/supabase/workspace";
import { onboardingIntake } from "@/lib/onboarding";
export const runtime = "nodejs";
const cookieName = "fitness_local_session";
const limits = new Map<string, { count: number; reset: number }>();
function localOnly(req: NextRequest) {
  const hostname = req.nextUrl.hostname;
  return (
    process.env.LOCAL_DEVELOPMENT === "true" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(hostname)
  );
}
function response(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
async function sessionResponse(userId: string) {
  const db = await database();
  const token = await createSession(db, userId);
  const jar = await cookies();
  jar.set(cookieName, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: false,
    path: "/",
    maxAge: 43200,
  });
  return response({ ok: true });
}
async function authorizedClient(
  actor: NonNullable<Awaited<ReturnType<typeof getActor>>>,
  clientId: string,
) {
  const db = await database();
  const ids = await db.query<{ client_id: string }>(
    `SELECT client_id FROM relationships WHERE expert_id=$1 AND status='active'`,
    [actor.id],
  );
  return canAccessClient(
    actor,
    clientId,
    ids.rows.map((r) => r.client_id),
  );
}
export async function GET(req: NextRequest) {
  if (cloudConfigured() && process.env.LOCAL_SYNTHETIC_TESTS !== "true")
    return cloudGet(req);
  if (!localOnly(req))
    return response(
      {
        error:
          "Ova verzija je dostupna samo za lokalno testiranje izmišljenih podataka.",
      },
      503,
    );
  const db = await database();
  const jar = await cookies();
  const actor = await getActor(db, jar.get(cookieName)?.value ?? "");
  if (!actor) return response({ error: "Prijavite se da nastavite." }, 401);
  const expert = actor.role === "trainer";
  const clientId =
    req.nextUrl.searchParams.get("client") ??
    (expert ? "demo-client" : actor.id);
  if (!(await authorizedClient(actor, clientId)))
    return response({ error: "Pristup nije dozvoljen." }, 403);
  const prefs = await db.query(
    `SELECT modules,intake,version FROM preferences WHERE user_id=$1`,
    [actor.id],
  );
  const clients = expert
    ? (
        await db.query(
          `SELECT u.id,u.name,u.email,u.onboarded FROM users u JOIN relationships r ON r.client_id=u.id WHERE r.expert_id=$1 AND r.status='active' ORDER BY u.name`,
          [actor.id],
        )
      ).rows
    : [];
  const plans = (
    await db.query(
      `SELECT p.*,u.name AS author_name FROM plans p JOIN users u ON u.id=p.author_id WHERE client_id=$1 ORDER BY version DESC`,
      [clientId],
    )
  ).rows;
  const logs = (
    await db.query(
      `SELECT * FROM workout_logs WHERE client_id=$1 ORDER BY completed_at`,
      [clientId],
    )
  ).rows;
  const checkins = (
    await db.query(
      `SELECT * FROM checkins WHERE client_id=$1 ORDER BY created_at DESC`,
      [clientId],
    )
  ).rows;
  const tasks = expert
    ? (
        await db.query(
          `SELECT t.*,u.name AS client_name FROM tasks t JOIN users u ON u.id=t.client_id WHERE owner_id=$1 ORDER BY created_at DESC`,
          [actor.id],
        )
      ).rows
    : [];
  const team = (
    await db.query<{ id: string; name: string; role: string }>(
      `SELECT u.id,u.name,u.role FROM users u JOIN relationships r ON r.expert_id=u.id WHERE r.client_id=$1 AND r.status='active'`,
      [clientId],
    )
  ).rows;
  const messages = (
    await db.query(
      `SELECT m.*,u.name AS sender_name FROM messages m JOIN users u ON u.id=m.sender_id WHERE (sender_id=$1 AND recipient_id=$2) OR (sender_id=$2 AND recipient_id=$1) ORDER BY created_at`,
      [clientId, expert ? actor.id : (team[0]?.id ?? "none")],
    )
  ).rows;
  const diary = (
    await db.query(
      `SELECT * FROM diary WHERE user_id=$1 ORDER BY created_at DESC`,
      [clientId],
    )
  ).rows;
  const sessions = (
    await db.query(
      "SELECT * FROM workout_sessions WHERE client_id=$1 ORDER BY started_at DESC",
      [clientId],
    )
  ).rows;
  return response({
    sessions,
    actor,
    preferences: prefs.rows[0] ?? { modules: [], intake: {}, version: 1 },
    clients,
    clientId,
    plans,
    logs,
    checkins,
    tasks,
    team,
    messages,
    diary,
    environment: "local-synthetic",
  });
}

export async function POST(req: NextRequest) {
  if (cloudConfigured() && process.env.LOCAL_SYNTHETIC_TESTS !== "true")
    return cloudPost(req);
  if (!localOnly(req))
    return response({ error: "Lokalni razvoj je isključen." }, 503);
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host"))
    return response({ error: "Zahtjev dolazi s nedozvoljene adrese." }, 403);
  if (!req.headers.get("content-type")?.includes("application/json"))
    return response({ error: "Zahtjev mora biti u JSON formatu." }, 415);
  try {
    const length = Number(req.headers.get("content-length") ?? 0);
    if (length > 16000) return response({ error: "Zahtjev je prevelik." }, 413);
    const text = await req.text();
    if (text.length > 16000)
      return response({ error: "Zahtjev je prevelik." }, 413);
    const body = z
      .object({
        action: z.string(),
        payload: z.record(z.string(), z.unknown()).default({}),
      })
      .parse(JSON.parse(text));
    const p = body.payload;
    const db = await database();
    if (["demo", "login", "register"].includes(body.action)) {
      const key = req.headers.get("x-real-ip") ?? "local";
      const entry = limits.get(key) ?? { count: 0, reset: Date.now() + 60000 };
      if (entry.reset < Date.now()) {
        entry.count = 0;
        entry.reset = Date.now() + 60000;
      }
      entry.count++;
      limits.set(key, entry);
      if (entry.count > 30)
        return response(
          { error: "Sačekajte minutu prije ponovnog pokušaja." },
          429,
        );
      if (body.action === "demo") {
        const role = z.enum(["client", "trainer"]).parse(p.role);
        return sessionResponse(
          role === "trainer" ? "demo-trainer" : "demo-client",
        );
      }
      const email = z.email().max(160).parse(p.email).toLowerCase();
      const password = z.string().min(12).max(128).parse(p.password);
      if (body.action === "login") {
        const row = (
          await db.query<{ id: string; password_hash: string }>(
            `SELECT id,password_hash FROM users WHERE email=$1`,
            [email],
          )
        ).rows[0];
        if (!row?.password_hash || !verifyPassword(password, row.password_hash))
          return response({ error: "E-pošta ili lozinka nisu ispravni." }, 401);
        return sessionResponse(row.id);
      }
      const name = z.string().trim().min(2).max(80).parse(p.name);
      const id = crypto.randomUUID();
      await db.transaction(async (tx) => {
        await tx.query(
          `INSERT INTO users(id,email,name,role,password_hash) VALUES($1,$2,$3,'client',$4)`,
          [id, email, name, hashPassword(password)],
        );
        await tx.query(`INSERT INTO preferences(user_id) VALUES($1)`, [id]);
      });
      return sessionResponse(id);
    }
    const jar = await cookies();
    const token = jar.get(cookieName)?.value ?? "";
    const actor = await getActor(db, token);
    if (!actor)
      return response(
        { error: "Vaša sesija je istekla. Prijavite se ponovo." },
        401,
      );
    if (body.action === "logout") {
      await db.query("DELETE FROM sessions WHERE token_hash=$1", [
        tokenHash(token),
      ]);
      jar.delete(cookieName);
      return response({ ok: true });
    }
    const clientId = typeof p.clientId === "string" ? p.clientId : actor.id;
    if (!(await authorizedClient(actor, clientId)))
      return response({ error: "Pristup nije dozvoljen." }, 403);
    const expert = actor.role === "trainer";
    switch (body.action) {
      case "preferences": {
        const selected = normalizeModules(z.array(z.string()).parse(p.modules));
        await db.query(
          `UPDATE preferences SET modules=$2,version=version+1,updated_at=now() WHERE user_id=$1`,
          [actor.id, JSON.stringify(selected)],
        );
        break;
      }
      case "onboard": {
        const intake = onboardingIntake.parse(p.intake);
        const selected = normalizeModules(z.array(z.string()).parse(p.modules));
        await db.transaction(async (tx) => {
          await tx.query(
            `UPDATE preferences SET modules=$2,intake=$3,version=version+1 WHERE user_id=$1`,
            [actor.id, JSON.stringify(selected), JSON.stringify(intake)],
          );
          await tx.query(`UPDATE users SET onboarded=true WHERE id=$1`, [
            actor.id,
          ]);
        });
        break;
      }
      case "startSession": {
        if (actor.id !== clientId)
          return response(
            { error: "Samo korisnik može započeti svoj trening." },
            403,
          );
        const planId = z.string().parse(p.planId);
        if (
          !(
            await db.query(
              "SELECT id FROM plans WHERE id=$1 AND client_id=$2",
              [planId, actor.id],
            )
          ).rows.length
        )
          return response({ error: "Odaberite dodijeljeni plan." }, 400);
        await db.query(
          "INSERT INTO workout_sessions(id,client_id,plan_id) VALUES($1,$2,$3) ON CONFLICT(client_id) WHERE completed_at IS NULL DO NOTHING",
          [crypto.randomUUID(), actor.id, planId],
        );
        break;
      }
      case "completeSession": {
        const id = z.string().parse(p.sessionId);
        const result = await db.query(
          "UPDATE workout_sessions SET completed_at=now() WHERE id=$1 AND client_id=$2 AND completed_at IS NULL AND EXISTS(SELECT 1 FROM workout_logs WHERE session_id=$1) RETURNING id",
          [id, actor.id],
        );
        if (!result.rows.length)
          return response(
            { error: "Prvo zabilježite seriju u aktivnom treningu." },
            400,
          );
        break;
      }
      case "logSet": {
        if (actor.id !== clientId)
          return response(
            { error: "Samo korisnik može zabilježiti odrađene serije." },
            403,
          );
        const log = z
          .object({
            id: z.uuid(),
            sessionId: z.string(),
            planId: z.string().max(80),
            exerciseId: z.string().max(80),
            setIndex: z.number().int().min(0).max(30),
            weight: z.number(),
            reps: z.number().optional(),
            durationSeconds: z.number().optional(),
          })
          .parse(p);
        const plan = (
          await db.query<{ exercises: typeof exercises }>(
            `SELECT exercises FROM plans WHERE id=$1 AND client_id=$2`,
            [log.planId, clientId],
          )
        ).rows[0];
        const exercise = plan?.exercises.find((e) => e.id === log.exerciseId);
        if (!exercise || log.setIndex >= exercise.sets)
          return response(
            { error: "Ova serija nije dio dodijeljenog plana." },
            400,
          );
        const timed = isTimed(exercise);
        const performed = timed ? log.durationSeconds : log.reps;
        if (
          performed === undefined ||
          !Number.isInteger(performed) ||
          performed < 1 ||
          performed > (timed ? 3600 : 200) ||
          !Number.isFinite(log.weight) ||
          log.weight < 0 ||
          log.weight > 1000
        )
          return response({ error: "Provjerite vrijednosti serije." }, 400);
        if (
          !(
            await db.query(
              "SELECT id FROM workout_sessions WHERE id=$1 AND client_id=$2 AND plan_id=$3 AND completed_at IS NULL",
              [log.sessionId, actor.id, log.planId],
            )
          ).rows.length
        )
          return response({ error: "Prvo započnite trening." }, 400);
        await db.query(
          `INSERT INTO workout_logs(id,client_id,plan_id,session_id,exercise_id,set_index,weight,reps,duration_seconds) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(session_id,exercise_id,set_index) DO UPDATE SET weight=EXCLUDED.weight,reps=EXCLUDED.reps,duration_seconds=EXCLUDED.duration_seconds`,
          [
            log.id,
            clientId,
            log.planId,
            log.sessionId,
            log.exerciseId,
            log.setIndex,
            log.weight,
            timed ? null : performed,
            timed ? performed : null,
          ],
        );
        break;
      }
      case "checkin": {
        if (actor.id !== clientId)
          return response(
            { error: "Samo korisnik može poslati svoj izvještaj." },
            403,
          );
        const data = z
          .object({
            energy: z.number().int().min(1).max(5),
            sleep: z.number().min(0).max(24),
            note: z.string().max(2000),
          })
          .parse(p);
        await db.transaction(async (tx) => {
          const checkinId = crypto.randomUUID();
          await tx.query(
            `INSERT INTO checkins(id,client_id,energy,sleep,note) VALUES($1,$2,$3,$4,$5)`,
            [checkinId, clientId, data.energy, data.sleep, data.note],
          );
          const experts = await tx.query<{ expert_id: string }>(
            `SELECT expert_id FROM relationships WHERE client_id=$1 AND status='active'`,
            [clientId],
          );
          for (const e of experts.rows)
            await tx.query(
              `INSERT INTO tasks(id,owner_id,client_id,checkin_id,kind,title) VALUES($1,$2,$3,$4,'checkin','Weekly check-in ready to review')`,
              [crypto.randomUUID(), e.expert_id, clientId, checkinId],
            );
        });
        break;
      }
      case "review": {
        if (!expert)
          return response({ error: "Potreban je pristup trenera." }, 403);
        const taskId = z.string().parse(p.taskId);
        const note = z.string().trim().min(1).max(2000).parse(p.note);
        await db.transaction(async (tx) => {
          const task = (
            await tx.query<{ client_id: string; checkin_id: string }>(
              `SELECT client_id,checkin_id FROM tasks WHERE id=$1 AND owner_id=$2 AND status='open'`,
              [taskId, actor.id],
            )
          ).rows[0];
          if (!task) throw new Error("Zadatak više nije dostupan.");
          await tx.query(`UPDATE tasks SET status='resolved' WHERE id=$1`, [
            taskId,
          ]);
          await tx.query(
            `UPDATE checkins SET status='reviewed',review_note=$2 WHERE id=$1 AND status='pending'`,
            [task.checkin_id, note],
          );
        });
        break;
      }
      case "publishPlan": {
        if (!expert || clientId === actor.id)
          return response({ error: "Odaberite dodijeljenog klijenta." }, 403);
        const title = z.string().trim().min(3).max(120).parse(p.title);
        const reason = z.string().trim().min(3).max(500).parse(p.reason);
        const nextExercises = z
          .array(
            z.object({
              id: z.string().max(40),
              name: z.string().min(2).max(80),
              group: z.string().max(60),
              sets: z.number().int().min(1).max(10),
              reps: z.string().min(1).max(30),
              weight: z.number().min(0).max(1000),
              cue: z.string().max(200),
              metric: z.enum(["reps", "seconds"]).optional(),
            }),
          )
          .min(1)
          .max(20)
          .parse(p.exercises);
        await db.transaction(async (tx) => {
          const max = (
            await tx.query<{ version: number }>(
              `SELECT COALESCE(MAX(version),0)+1 AS version FROM plans WHERE client_id=$1`,
              [clientId],
            )
          ).rows[0].version;
          await tx.query(
            `INSERT INTO plans(id,client_id,author_id,title,version,exercises,reason) VALUES($1,$2,$3,$4,$5,$6,$7)`,
            [
              crypto.randomUUID(),
              clientId,
              actor.id,
              title,
              max,
              JSON.stringify(nextExercises),
              reason,
            ],
          );
        });
        break;
      }
      case "message": {
        const recipient = z.string().parse(p.recipientId);
        const text = z.string().trim().min(1).max(2000).parse(p.text);
        const pair = await db.query(
          `SELECT id FROM relationships WHERE status='active' AND ((expert_id=$1 AND client_id=$2) OR (expert_id=$2 AND client_id=$1))`,
          [actor.id, recipient],
        );
        if (!pair.rows.length)
          return response({ error: "Potrebna je aktivna saradnja." }, 403);
        await db.query(
          `INSERT INTO messages(id,sender_id,recipient_id,body) VALUES($1,$2,$3,$4)`,
          [crypto.randomUUID(), actor.id, recipient, text],
        );
        break;
      }
      case "diary": {
        if (actor.id !== clientId)
          return response(
            { error: "Samo korisnik može unositi podatke u svoj dnevnik." },
            403,
          );
        const data = z
          .object({
            kind: z.enum(["meal", "water", "sleep", "energy", "measurement"]),
            label: z.string().trim().min(1).max(200),
            value: z.number().min(0).max(10000).optional(),
          })
          .parse(p);
        await db.query(
          `INSERT INTO diary(id,user_id,kind,label,value) VALUES($1,$2,$3,$4,$5)`,
          [
            crypto.randomUUID(),
            clientId,
            data.kind,
            data.label,
            data.value ?? null,
          ],
        );
        break;
      }
      case "invite": {
        if (!expert)
          return response({ error: "Potreban je pristup trenera." }, 403);
        const email = z.email().max(160).parse(p.email).toLowerCase();
        const raw = crypto.randomUUID();
        const id = crypto.randomUUID();
        await db.query(
          `INSERT INTO invitations(id,token_hash,expert_id,email,expires_at) VALUES($1,$2,$3,$4,now()+interval '7 days')`,
          [id, tokenHash(raw), actor.id, email],
        );
        return response({
          ok: true,
          inviteToken: raw,
          note: "Local invitation created. No email was sent.",
        });
      }
      case "acceptInvite": {
        if (actor.role !== "client")
          return response({ error: "Potreban je korisnički račun." }, 403);
        const raw = z.string().parse(p.token);
        await db.transaction(async (tx) => {
          const invite = (
            await tx.query<{ id: string; expert_id: string; email: string }>(
              `SELECT id,expert_id,email FROM invitations WHERE token_hash=$1 AND status='pending' AND expires_at>now()`,
              [tokenHash(raw)],
            )
          ).rows[0];
          if (!invite || invite.email !== actor.email)
            throw new Error(
              "Poziv je istekao ili pripada drugoj adresi e-pošte.",
            );
          await tx.query(
            `INSERT INTO relationships(id,expert_id,client_id) VALUES($1,$2,$3) ON CONFLICT(expert_id,client_id) DO UPDATE SET status='active'`,
            [crypto.randomUUID(), invite.expert_id, actor.id],
          );
          await tx.query(
            `UPDATE invitations SET status='accepted' WHERE id=$1`,
            [invite.id],
          );
        });
        break;
      }
      default:
        return response({ error: "Nepoznata radnja." }, 400);
    }
    await db.query(
      `INSERT INTO audit(id,actor_id,action,resource_id) VALUES($1,$2,$3,$4)`,
      [crypto.randomUUID(), actor.id, body.action, clientId],
    );
    return response({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError)
      return response(
        { error: e.issues[0]?.message ?? "Check your input." },
        400,
      );
    if (e instanceof Error && e.message.includes("duplicate key"))
      return response(
        { error: "An account with that email already exists." },
        409,
      );
    console.error(
      "Workspace request failed:",
      e instanceof Error ? e.message : "unknown",
    );
    return response(
      {
        error:
          e instanceof Error && e.message.startsWith("Invitation")
            ? e.message
            : "Nije moguće sačuvati. Pokušajte ponovo.",
      },
      400,
    );
  }
}
