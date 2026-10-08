import { beforeAll, afterAll, it, expect } from "vitest";
import { PGlite } from "../apps/web/node_modules/@electric-sql/pglite";
import {
  initialize,
  createSession,
  getActor,
  hashPassword,
  verifyPassword,
} from "../apps/web/lib/db";
let db: PGlite;
beforeAll(async () => {
  db = await initialize(new PGlite());
});
afterAll(async () => {
  await db.close();
});
it("seeds isolated synthetic relationships and is repeatable", async () => {
  await initialize(db);
  expect((await db.query("SELECT id FROM users")).rows).toHaveLength(4);
  expect((await db.query("SELECT id FROM relationships")).rows).toHaveLength(3);
});
it("stores only hashed session tokens and respects revocation", async () => {
  const token = await createSession(db, "demo-client");
  expect((await getActor(db, token))?.id).toBe("demo-client");
  expect(await getActor(db, "invented")).toBeNull();
  expect(
    JSON.stringify((await db.query("SELECT token_hash FROM sessions")).rows),
  ).not.toContain(token);
  await db.query("DELETE FROM sessions");
  expect(await getActor(db, token)).toBeNull();
});
it("password hashes use unique salts and reject mismatches", () => {
  const a = hashPassword("synthetic-passphrase-1");
  const b = hashPassword("synthetic-passphrase-1");
  expect(a).not.toBe(b);
  expect(verifyPassword("synthetic-passphrase-1", a)).toBe(true);
  expect(verifyPassword("wrong-passphrase", a)).toBe(false);
});
it("duplicates cannot create extra performed sets", async () => {
  await db.query(
    "INSERT INTO workout_sessions(id,client_id,plan_id) VALUES('test-session','demo-client','plan-demo-client')",
  );
  for (let i = 0; i < 2; i++)
    await db.query(
      `INSERT INTO workout_logs(id,client_id,plan_id,session_id,exercise_id,set_index,weight,reps) VALUES($1,'demo-client','plan-demo-client','test-session','squat',0,60,10) ON CONFLICT(session_id,exercise_id,set_index) DO UPDATE SET weight=EXCLUDED.weight`,
      [crypto.randomUUID()],
    );
  expect((await db.query("SELECT id FROM workout_logs")).rows).toHaveLength(1);
});
it("new plan versions preserve historical performed work", async () => {
  await db.query(
    `INSERT INTO plans(id,client_id,author_id,title,version,exercises,reason) VALUES('second','demo-client','demo-trainer','Updated',2,'[]','Reviewed change')`,
  );
  expect(
    (await db.query("SELECT id FROM plans WHERE client_id=$1", ["demo-client"]))
      .rows,
  ).toHaveLength(2);
  expect(
    (await db.query<{ plan_id: string }>("SELECT plan_id FROM workout_logs"))
      .rows[0].plan_id,
  ).toBe("plan-demo-client");
});
