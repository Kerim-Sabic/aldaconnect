import { beforeAll, afterAll, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { PGlite } from "../apps/web/node_modules/@electric-sql/pglite";
let db: PGlite;
const member = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const trainer = "00000000-0000-4000-8000-000000000003";
const act = async (id: string) => {
  await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [id]);
};
beforeAll(async () => {
  db = new PGlite();
  // Emulate Supabase's platform schemas locally. Digest is a SQL compilation stub;
  // production uses pgcrypto SHA-256, and this test does not certify cryptography.
  await db.exec(`create role anon; create role authenticated; create schema auth; create schema storage; create schema extensions;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function extensions.digest(text,text) returns bytea language sql as $$select decode(md5($1),'hex')$$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 grant usage on schema public,auth to authenticated; grant execute on function auth.uid() to authenticated;`);
  await db.exec(
    readFileSync("supabase/migrations/202610080001_workspace.sql", "utf8"),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/202610080002_workout_sessions.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync("supabase/migrations/202610080003_timed_sets.sql", "utf8"),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/202610080004_bosnian_messages.sql",
      "utf8",
    ),
  );
  for (const [id, name] of [
    [member, "Test Member"],
    [other, "Other Member"],
    [trainer, "Test Trainer"],
  ])
    await db.query(`insert into auth.users values($1,$2,$3)`, [
      id,
      id + "@example.test",
      JSON.stringify({ name, role: "trainer" }),
    ]);
  await db.query(`update public.users set role='trainer' where id=$1`, [
    trainer,
  ]);
  await db.query(
    `insert into public.relationships(id,expert_id,client_id) values('assigned',$1,$2)`,
    [trainer, member],
  );
});
afterAll(async () => {
  await db.close();
});

it("never trusts role metadata supplied at signup", async () => {
  expect(
    (
      await db.query<{ role: string }>(
        `select role from public.users where id=$1`,
        [member],
      )
    ).rows[0].role,
  ).toBe("client");
});
it("denies unrelated client snapshots even through the definer RPC", async () => {
  await act(other);
  await expect(
    db.query(`select public.workspace_snapshot($1)`, [member]),
  ).rejects.toThrow("Pristup nije dozvoljen");
});
it("applies RLS to direct reads and denies direct profile writes", async () => {
  await act(other);
  await db.exec("set role authenticated");
  try {
    expect((await db.query(`select id from public.users`)).rows).toHaveLength(
      1,
    );
    await expect(
      db.query(`update public.users set role='trainer'`),
    ).rejects.toThrow("permission denied");
  } finally {
    await db.exec("reset role");
  }
});
it("preserves plan versions and rejects trainer logs on behalf of members", async () => {
  await act(trainer);
  const payload = {
    clientId: member,
    title: "Test strength plan",
    reason: "Reviewed progression",
    exercises: [{ id: "squat", name: "Squat", sets: 3, reps: "8", weight: 20 }],
  };
  await db.query(`select public.workspace_action('publishPlan',$1)`, [payload]);
  await db.query(`select public.workspace_action('publishPlan',$1)`, [payload]);
  expect(
    (await db.query(`select id from public.plans where client_id=$1`, [member]))
      .rows,
  ).toHaveLength(2);
  await expect(
    db.query(`select public.workspace_action('logSet',$1)`, [
      { clientId: member },
    ]),
  ).rejects.toThrow("Samo korisnik");
});
it("resolves only the check-in linked to the reviewed task", async () => {
  await act(member);
  for (let i = 0; i < 2; i++)
    await db.query(`select public.workspace_action('checkin',$1)`, [
      { energy: 4, sleep: 8, note: "Test check-in" },
    ]);
  await act(trainer);
  const task = (
    await db.query<{ id: string }>(`select id from public.tasks limit 1`)
  ).rows[0];
  await db.query(`select public.workspace_action('review',$1)`, [
    { taskId: task.id, note: "Reviewed test entry" },
  ]);
  expect(
    (await db.query(`select id from public.checkins where status='pending'`))
      .rows,
  ).toHaveLength(1);
});
it("requires a matching signed-in email for invitations", async () => {
  await act(trainer);
  const invitation = (
    await db.query<{ result: { inviteToken: string } }>(
      `select public.workspace_action('invite',$1) as result`,
      [{ email: member + "@example.test" }],
    )
  ).rows[0].result;
  await act(other);
  await expect(
    db.query(`select public.workspace_action('acceptInvite',$1)`, [
      { token: invitation.inviteToken },
    ]),
  ).rejects.toThrow("drugoj adresi");
  await act(member);
  await db.query(`select public.workspace_action('acceptInvite',$1)`, [
    { token: invitation.inviteToken },
  ]);
  await expect(
    db.query(`select public.workspace_action('acceptInvite',$1)`, [
      { token: invitation.inviteToken },
    ]),
  ).rejects.toThrow("istekao");
});

it("keeps repeat workouts separate and treats retries idempotently", async () => {
  await act(member);
  const plan = (
    await db.query<{ id: string }>(
      `select id from public.plans where client_id=$1 order by version desc limit 1`,
      [member],
    )
  ).rows[0];
  const call = async (action: string, payload: unknown) =>
    (
      await db.query<{ result: { sessionId: string } }>(
        `select public.workspace_action($1,$2) as result`,
        [action, payload],
      )
    ).rows[0].result;
  const first = await call("startSession", { planId: plan.id });
  const same = await call("startSession", { planId: plan.id });
  expect(same.sessionId).toBe(first.sessionId);
  const payload = {
    id: crypto.randomUUID(),
    sessionId: first.sessionId,
    planId: plan.id,
    exerciseId: "squat",
    setIndex: 0,
    weight: 20,
    reps: 8,
  };
  await call("logSet", payload);
  await call("logSet", payload);
  expect(
    (
      await db.query("select id from public.workout_logs where session_id=$1", [
        first.sessionId,
      ])
    ).rows,
  ).toHaveLength(1);
  await call("completeSession", { sessionId: first.sessionId });
  await expect(call("logSet", payload)).rejects.toThrow("više nije aktivan");
  const second = await call("startSession", { planId: plan.id });
  expect(second.sessionId).not.toBe(first.sessionId);
  await call("logSet", {
    ...payload,
    id: crypto.randomUUID(),
    sessionId: second.sessionId,
  });
  expect(
    (
      await db.query("select id from public.workout_logs where client_id=$1", [
        member,
      ])
    ).rows,
  ).toHaveLength(2);
  await expect(
    call("logSet", {
      ...payload,
      id: crypto.randomUUID(),
      sessionId: second.sessionId,
      reps: 1.5,
    }),
  ).rejects.toThrow("podatke o seriji");
});

it("stores timed holds as seconds rather than repetitions", async () => {
  await act(trainer);
  const payload = {
    clientId: member,
    title: "Timed test plan",
    reason: "Test duration recording",
    exercises: [
      { id: "hold", name: "Plank", sets: 2, reps: "30 sec", weight: 0 },
    ],
  };
  await db.query(`select public.workspace_action('publishPlan',$1)`, [payload]);
  await act(member);
  // This test creates an isolated plan and closes any prior test session.
  await db.query(
    `update public.workout_sessions set completed_at=now() where client_id=$1 and completed_at is null`,
    [member],
  );
  const plan = (
    await db.query<{ id: string }>(
      `select id from public.plans where title='Timed test plan'`,
    )
  ).rows[0];
  const session = (
    await db.query<{ result: { sessionId: string } }>(
      `select public.workspace_action('startSession',$1) as result`,
      [{ planId: plan.id }],
    )
  ).rows[0].result.sessionId;
  const values = {
    id: crypto.randomUUID(),
    sessionId: session,
    planId: plan.id,
    exerciseId: "hold",
    setIndex: 0,
    weight: 0,
    durationSeconds: 35,
  };
  await db.query(`select public.workspace_action('logSet',$1)`, [values]);
  const log = (
    await db.query<{ reps: number | null; duration_seconds: number }>(
      `select reps,duration_seconds from public.workout_logs where session_id=$1`,
      [session],
    )
  ).rows[0];
  expect(log).toEqual({ reps: null, duration_seconds: 35 });
  await expect(
    db.query(`select public.workspace_action('logSet',$1)`, [
      { ...values, durationSeconds: null, reps: 10 },
    ]),
  ).rejects.toThrow("podatke o seriji");
  await db.query(`select public.workspace_action('completeSession',$1)`, [
    { sessionId: session },
  ]);
});
