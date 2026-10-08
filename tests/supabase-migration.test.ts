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
 create function extensions.crypt(text,text) returns text language sql as $$select case when $2 like '%:test-salt' then case when split_part($2,':',1)=$1 then $2 else 'wrong' end else $1||':'||$2 end$$;
 create function extensions.gen_salt(text,integer) returns text language sql as $$select 'test-salt'::text$$;
 create function extensions.gen_random_bytes(integer) returns bytea language sql as $$select decode(md5(random()::text)||md5(random()::text),'hex')$$;
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
  await db.exec(
    readFileSync(
      "supabase/migrations/202610080005_username_accounts.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/202610080006_admin_previews_invites.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync("supabase/migrations/202610080007_private_cycle.sql", "utf8"),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/202610080008_medication_records.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync("supabase/migrations/202610080009_test_labs.sql", "utf8"),
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

it("requires client consent for both trainer and doctor edits and preserves attributed versions", async () => {
  const doctor = "d0000000-0000-4000-8000-000000000001";
  await db.query(
    "insert into auth.users values($1,'doctor@example.test','{\"name\":\"Test Doctor\"}')",
    [doctor],
  );
  await db.query("update public.users set role='doctor' where id=$1", [doctor]);
  await db.query(
    "insert into public.relationships(id,client_id,expert_id) values('doctor-assignment',$1,$2)",
    [member, doctor],
  );
  const content = {
    category: "ped",
    name: "Synthetic disclosure",
    dose: "Recorded only",
    route: "",
    frequency: "",
    timing: "",
    note: "No real treatment",
    status: "active",
    start: "",
    end: "",
  };
  const id = "d1000000-0000-4000-8000-000000000001";
  await act(trainer);
  await expect(
    db.query("select public.medications_action('save',$1)", [
      { id, version: 0, clientId: member, content },
    ]),
  ).rejects.toThrow("odobrio");
  await act(doctor);
  await expect(
    db.query("select public.medications_action('save',$1)", [
      { id, version: 0, clientId: member, content },
    ]),
  ).rejects.toThrow("odobrio");
  await act(member);
  for (const expertId of [trainer, doctor])
    await db.query("select public.medications_action('grant',$1)", [
      { expertId, granted: true },
    ]);
  await act(trainer);
  await db.query("select public.medications_action('save',$1)", [
    { id, version: 0, clientId: member, content },
  ]);
  await act(doctor);
  await db.query("select public.medications_action('save',$1)", [
    {
      id,
      version: 1,
      clientId: member,
      content: { ...content, note: "Doctor changed the disclosure note" },
    },
  ]);
  await expect(
    db.query("select public.medications_action('save',$1)", [
      { id, version: 1, clientId: member, content },
    ]),
  ).rejects.toThrow("međuvremenu");
  const versions = (
    await db.query<{ actor_role: string; version: number }>(
      "select actor_role,version from public.medication_versions where record_id=$1 order by version",
      [id],
    )
  ).rows;
  expect(versions).toEqual([
    { actor_role: "trainer", version: 1 },
    { actor_role: "doctor", version: 2 },
  ]);
  await db.query("select public.medications_action('remove',$1)", [
    { id, version: 2, clientId: member },
  ]);
  await db.query("select public.medications_action('restore',$1)", [
    { id, version: 3, clientId: member },
  ]);
  await act(member);
  const snapshot = (
    await db.query<{ value: { history: unknown[]; entries: unknown[] } }>(
      "select public.medications_action() as value",
    )
  ).rows[0].value;
  expect(snapshot.entries).toHaveLength(1);
  expect(snapshot.history).toHaveLength(4);
  await db.query("select public.medications_action('grant',$1)", [
    { expertId: doctor, granted: false },
  ]);
  await act(doctor);
  const revoked = (
    await db.query<{ value: { entries: unknown[] } }>(
      "select public.medications_action('snapshot',$1) as value",
      [{ clientId: member }],
    )
  ).rows[0].value;
  expect(revoked.entries).toEqual([]);
  await expect(
    db.query("select public.medications_action('save',$1)", [
      { id, version: 4, clientId: member, content },
    ]),
  ).rejects.toThrow("odobrio");
  await act(other);
  await expect(
    db.query("select public.medications_action('snapshot',$1)", [
      { clientId: member },
    ]),
  ).rejects.toThrow("Pristup");
  await db.exec("set role authenticated");
  try {
    await expect(
      db.query("select * from public.medication_versions"),
    ).rejects.toThrow();
  } finally {
    await db.exec("reset role");
  }
});

it("keeps cycle entries owner-only across RPCs, direct reads and admin previews", async () => {
  const entry = {
    id: "c1000000-0000-4000-8000-000000000001",
    date: "2026-01-01",
    bleeding: "light",
    pain: 2,
    symptoms: ["fatigue"],
    note: "Synthetic private entry",
  };
  await act(member);
  await db.query("select public.cycle_action('save',$1)", [entry]);
  await act(other);
  const snapshot = (
    await db.query<{ value: { entries: unknown[] } }>(
      "select public.cycle_action() as value",
    )
  ).rows[0].value;
  expect(snapshot.entries).toEqual([]);
  await expect(
    db.query("select public.cycle_action('remove',$1)", [{ id: entry.id }]),
  ).rejects.toThrow();
  await expect(
    db.query("select public.cycle_action('save',$1)", [entry]),
  ).rejects.toThrow("Pristup");
  await db.exec("set role authenticated");
  try {
    expect((await db.query("select * from public.cycle_entries")).rows).toEqual(
      [],
    );
  } finally {
    await db.exec("reset role");
  }
  await act(trainer);
  await expect(db.query("select public.cycle_action()")).rejects.toThrow(
    "vlasniku",
  );
  const assigned = (
    await db.query<{ value: unknown }>(
      "select public.workspace_snapshot($1) as value",
      [member],
    )
  ).rows[0].value;
  expect(JSON.stringify(assigned)).not.toContain(entry.note);
  await act(member);
  await db.query("select public.cycle_action('save',$1)", [
    { ...entry, note: "Updated synthetic entry" },
  ]);
  expect(
    (
      await db.query("select id from public.cycle_entries where user_id=$1", [
        member,
      ])
    ).rows,
  ).toHaveLength(1);
  await db.query("select public.cycle_action('remove',$1)", [{ id: entry.id }]);
  expect(
    (
      await db.query<{ removed_at: unknown }>(
        "select removed_at from public.cycle_entries where id=$1",
        [entry.id],
      )
    ).rows[0].removed_at,
  ).toBeTruthy();
  await db.query("select public.cycle_action('restore',$1)", [
    { id: entry.id },
  ]);
  expect(
    (
      await db.query<{ removed_at: unknown }>(
        "select removed_at from public.cycle_entries where id=$1",
        [entry.id],
      )
    ).rows[0].removed_at,
  ).toBeNull();
  for (const invalid of [
    { pain: 11 },
    { date: "2999-01-01" },
    { symptoms: ["invalid"] },
  ])
    await expect(
      db.query("select public.cycle_action('save',$1)", [
        { ...entry, ...invalid },
      ]),
    ).rejects.toThrow();
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
const admin = "00000000-0000-4000-8000-000000000010";
async function usernameLogin(name: string, password: string) {
  return (
    await db.query<{ result: { token?: string; error?: string } }>(
      "select public.username_login($1,$2) as result",
      [name, password],
    )
  ).rows[0].result;
}
async function usernameAction(
  token: string,
  action = "snapshot",
  payload: Record<string, unknown> = {},
  preview: string | null = null,
) {
  return (
    await db.query<{ result: Record<string, any> }>(
      "select public.username_workspace($1,$2,$3,null,$4) as result",
      [token, action, JSON.stringify(payload), preview],
    )
  ).rows[0].result;
}
it("uses persistent username sessions without granting anonymous table access", async () => {
  await db.query("insert into auth.users values($1,$2,$3)", [
    admin,
    "admin@example.test",
    JSON.stringify({ name: "Test Administrator" }),
  ]);
  await db.query("update public.users set role='admin' where id=$1", [admin]);
  for (const [name, id] of [
    ["test-admin", admin],
    ["test-client", member],
  ])
    await db.query(
      "insert into app_private.username_accounts(username,user_id,password_hash) values($1,$2,extensions.crypt(encode(extensions.digest('initial','sha256'),'hex'),extensions.gen_salt('bf',12)))",
      [name, id],
    );
  const session = await usernameLogin("TEST-CLIENT", "initial");
  expect(session.token).toHaveLength(64);
  await db.exec("set role anon");
  try {
    await expect(
      db.query("select * from app_private.username_accounts"),
    ).rejects.toThrow();
    const snapshot = await usernameAction(session.token!);
    expect(snapshot.actor.id).toBe(member);
    expect(snapshot.adminUsers).toBeUndefined();
    await expect(
      usernameAction(session.token!, "snapshot", {}, other),
    ).rejects.toThrow("Pregledi");
    await expect(usernameAction("0".repeat(64))).rejects.toThrow("sesija");
    await usernameAction(session.token!, "diary", {
      kind: "water",
      label: "Voda",
      value: 250,
    });
    await usernameAction(session.token!, "logout");
    await expect(usernameAction(session.token!)).rejects.toThrow("sesija");
  } finally {
    await db.exec("reset role");
  }
});
it("admin previews are read only and restore the request identity", async () => {
  const session = await usernameLogin("test-admin", "initial");
  await act(other);
  const dashboard = await usernameAction(session.token!);
  expect(dashboard.adminUsers.length).toBeGreaterThan(2);
  const preview = await usernameAction(session.token!, "snapshot", {}, member);
  expect(preview.actor.id).toBe(member);
  expect(preview.readOnly).toBe(true);
  expect(
    (await db.query<{ id: string }>("select auth.uid()::text as id")).rows[0]
      .id,
  ).toBe(other);
  await expect(
    usernameAction(
      session.token!,
      "diary",
      { kind: "water", label: "No", value: 1 },
      member,
    ),
  ).rejects.toThrow("Pregledi");
  await expect(
    usernameAction(session.token!, "diary", {
      kind: "water",
      label: "No",
      value: 1,
    }),
  ).rejects.toThrow("stručni račun");
});
it("throttles repeated wrong passwords and revokes other sessions after password change", async () => {
  for (let i = 0; i < 5; i++)
    expect(
      (await usernameLogin("test-client", "incorrect")).error,
    ).toBeTruthy();
  expect((await usernameLogin("test-client", "initial")).token).toBeUndefined();
  await db.exec(
    "update app_private.username_accounts set locked_until=null,failures=0 where username='test-client'",
  );
  const first = await usernameLogin("test-client", "initial"),
    second = await usernameLogin("test-client", "initial");
  await expect(
    usernameAction(first.token!, "changePassword", {
      currentPassword: "incorrect",
      password: "new-long-password",
    }),
  ).rejects.toThrow("trenutnu");
  await usernameAction(first.token!, "changePassword", {
    currentPassword: "initial",
    password: "new-long-password",
  });
  await expect(usernameAction(second.token!)).rejects.toThrow("sesija");
  expect(
    (await usernameLogin("test-client", "new-long-password")).token,
  ).toHaveLength(64);
});
it("trainer invitations also resolve existing username clients and preserve acceptance checks", async () => {
  await act(trainer);
  const result = (
    await db.query<{ result: { inviteToken: string } }>(
      "select public.workspace_action('invite',$1) as result",
      [{ email: "test-client" }],
    )
  ).rows[0].result;
  expect(result.inviteToken).toBeTruthy();
  await act(other);
  await expect(
    db.query("select public.workspace_action('acceptInvite',$1)", [
      { token: result.inviteToken },
    ]),
  ).rejects.toThrow();
  await act(member);
  await db.query("select public.workspace_action('acceptInvite',$1)", [
    { token: result.inviteToken },
  ]);
  const session = await usernameLogin("test-admin", "initial");
  const preview = await usernameAction(
    session.token!,
    "snapshot",
    {},
    "role:trainer",
  );
  expect(preview.actor.role).toBe("trainer");
  expect(preview.readOnly).toBe(true);
  expect(preview.clients).toEqual([]);
});

it("does not let admin previews turn into private cycle access", async () => {
  const session = await usernameLogin("test-admin", "initial");
  const preview = await usernameAction(session.token!, "snapshot", {}, member);
  expect(JSON.stringify(preview)).not.toContain("Updated synthetic entry");
  await expect(
    db.query("select public.username_cycle($1)", [session.token!]),
  ).rejects.toThrow("vlasniku");
  const client = await usernameLogin("test-client", "new-long-password");
  const result = (
    await db.query<{ value: { entries: unknown[] } }>(
      "select public.username_cycle($1) as value",
      [client.token!],
    )
  ).rows[0].value;
  expect(result.entries).toHaveLength(1);
  await expect(
    db.query("select public.username_cycle($1)", ["f".repeat(64)]),
  ).rejects.toThrow("sesija");
  await act(member);
  await db.query("select public.workspace_action('onboard',$1)", [
    { modules: ["training", "cycle"], intake: {} },
  ]);
  expect(
    (
      await db.query<{ modules: string[] }>(
        "select modules from public.preferences where user_id=$1",
        [member],
      )
    ).rows[0].modules,
  ).toContain("cycle");
});
it("keeps medication access out of admin previews and revokes access on relationship termination", async () => {
  const adminSession = await usernameLogin("test-admin", "initial");
  await expect(
    db.query("select public.username_medications($1)", [adminSession.token!]),
  ).rejects.toThrow("nije dozvoljen");
  const preview = await usernameAction(
    adminSession.token!,
    "snapshot",
    {},
    member,
  );
  expect(JSON.stringify(preview)).not.toContain("Synthetic disclosure");
  await db.query(
    "update public.relationships set status='ended' where expert_id=$1 and client_id=$2",
    [trainer, member],
  );
  await act(trainer);
  await expect(
    db.query("select public.medications_action('snapshot',$1)", [
      { clientId: member },
    ]),
  ).rejects.toThrow("aktivnog klijenta");
  await db.query(
    "update public.relationships set status='active' where expert_id=$1 and client_id=$2",
    [trainer, member],
  );
  await db.query(
    "insert into app_private.username_accounts(username,user_id,password_hash) values('test-doctor','d0000000-0000-4000-8000-000000000001',extensions.crypt(encode(extensions.digest('fixture-password','sha256'),'hex'),extensions.gen_salt('bf',12)))",
  );
  const doctor = await usernameLogin("test-doctor", "fixture-password");
  const workspace = await usernameAction(doctor.token!);
  expect(workspace.actor.role).toBe("doctor");
  const context = (
    await db.query<{ value: { clients: unknown[] } }>(
      "select public.username_medications($1) as value",
      [doctor.token!],
    )
  ).rows[0].value;
  expect(context.clients).toHaveLength(1);
});

it("keeps test lab PDFs private, consented and attributed with immutable review history", async () => {
  const doctor = "d0000000-0000-4000-8000-000000000009";
  await db.query(
    `insert into auth.users values($1,'lab-doctor@example.test','{"name":"Lab Test Doctor"}')`,
    [doctor],
  );
  await db.query(`update public.users set role='doctor' where id=$1`, [doctor]);
  await db.query(
    `insert into public.relationships(id,client_id,expert_id,status) values('lab-test-assignment',$1,$2,'active')`,
    [member, doctor],
  );
  const call = async (actor: string, action: string, payload: object = {}) =>
    (
      await db.query<{ v: any }>(
        "select app_private.labs_dispatch($1,$2,$3) v",
        [actor, action, JSON.stringify(payload)],
      )
    ).rows[0].v;
  const id = "e0000000-0000-4000-8000-000000000001",
    reviewId = "e0000000-0000-4000-8000-000000000002";
  const pdf = Buffer.from("%PDF-1.4\nFICTIONAL TEST\n%%EOF").toString("base64");
  const upload = {
    id,
    title: "Synthetic report",
    provider: "Fictional fixture",
    date: "2026-01-01",
    fileBase64: pdf,
  };
  expect((await call(doctor, "snapshot", { clientId: member })).allowed).toBe(
    false,
  );
  await expect(
    call(doctor, "upload", { ...upload, clientId: member }),
  ).rejects.toThrow("odobrio");
  await call(member, "upload", upload);
  await call(member, "upload", upload);
  expect(
    (await call(member, "snapshot")).documents.filter((d: any) => d.id === id),
  ).toHaveLength(1);
  await expect(call(other, "file", { id })).rejects.toThrow("Pristup");
  await expect(call(trainer, "snapshot", { clientId: member })).rejects.toThrow(
    "ovlaštenom",
  );
  await expect(
    call(member, "upload", {
      ...upload,
      fileBase64: Buffer.from("%PDF-other").toString("base64"),
    }),
  ).rejects.toThrow("drugom");
  await call(member, "grant", { doctorId: doctor, granted: true });
  expect(
    Buffer.from(
      (await call(doctor, "file", { id, clientId: member })).fileBase64,
      "base64",
    ).toString(),
  ).toBe(Buffer.from(pdf, "base64").toString());
  const review = {
    id,
    reviewId,
    clientId: member,
    note: "Synthetic workflow review",
    decision: "reviewed",
    doctor_name: "Forged name",
  };
  await expect(call(member, "review", review)).rejects.toThrow(
    "ovlašteni doktor",
  );
  await call(doctor, "review", review);
  await call(doctor, "review", review);
  const snapshot = await call(member, "snapshot");
  expect(snapshot.reviews.filter((v: any) => v.id === reviewId)).toHaveLength(
    1,
  );
  expect(snapshot.reviews.find((v: any) => v.id === reviewId).doctor_name).toBe(
    "Lab Test Doctor",
  );
  expect(JSON.stringify(snapshot)).not.toContain("fileBase64");
  await expect(
    call(doctor, "review", { ...review, note: "Different content" }),
  ).rejects.toThrow("drugim sadržajem");
  await call(member, "remove", { id });
  await expect(
    call(doctor, "review", {
      ...review,
      reviewId: "e0000000-0000-4000-8000-000000000003",
    }),
  ).rejects.toThrow("ovlašteni");
  await call(member, "restore", { id });
  await call(member, "grant", { doctorId: doctor, granted: false });
  await expect(call(doctor, "file", { id, clientId: member })).rejects.toThrow(
    "odobrio",
  );
  await db.exec("set role authenticated");
  await expect(db.query("select * from public.lab_documents")).rejects.toThrow(
    "permission denied",
  );
  await expect(db.query("select * from app_private.lab_files")).rejects.toThrow(
    "permission denied",
  );
  await db.exec("reset role");
});

it("provisions only visibly marked test doctors through a valid admin session", async () => {
  const admin = "a0000000-0000-4000-8000-000000000009",
    token = "c".repeat(64);
  await db.query(
    `insert into auth.users values($1,'test-admin@example.test','{"name":"Test Admin"}')`,
    [admin],
  );
  await db.query(`update public.users set role='admin' where id=$1`, [admin]);
  await db.query(
    `insert into app_private.username_sessions(token_hash,user_id) values(encode(extensions.digest($1,'sha256'),'hex'),$2)`,
    [token, admin],
  );
  const password = "fixture-only-password";
  await expect(
    db.query(
      `select public.admin_test_doctor($1,'fixture-doc',$2,'Fixture Doctor',$3)`,
      ["x".repeat(64), password, member],
    ),
  ).rejects.toThrow("Administratorski");
  const profile = (
    await db.query<{ v: any }>(
      `select public.admin_test_doctor($1,'fixture-doc',$2,'Fixture Doctor',$3) v`,
      [token, password, member],
    )
  ).rows[0].v;
  expect(profile.name).toBe("Fixture Doctor (test)");
  expect(
    (
      await db.query<{ v: any }>(
        "select app_private.labs_dispatch($1,'snapshot',$2) v",
        [profile.id, JSON.stringify({ clientId: member })],
      )
    ).rows[0].v.allowed,
  ).toBe(true);
  expect(
    (
      await db.query("select is_test_profile from public.users where id=$1", [
        profile.id,
      ])
    ).rows[0].is_test_profile,
  ).toBe(true);
  await expect(
    db.query(
      `select public.admin_test_doctor($1,'fixture-doc',$2,'Changed',$3)`,
      [token, password, member],
    ),
  ).rejects.toThrow("zauzeto");
  const login = (
    await db.query<{ v: any }>(
      `select public.username_login('fixture-doc',$1) v`,
      [password],
    )
  ).rows[0].v;
  expect(login.ok).toBe(true);
  const workspace = (
    await db.query<{ v: any }>(`select public.username_workspace($1) v`, [
      login.token,
    ])
  ).rows[0].v;
  expect(workspace.actor.role).toBe("doctor");
});
