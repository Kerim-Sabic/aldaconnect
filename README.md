# Alda Connect

Original fitness and expert workspace. The approved full-product plan and backlog live in the parent project's `plans` directory. **The full product remains in development.** Product UI is Bosnian; technical documentation is English.

## Run locally

Use Node 24 and pnpm 11.25.0. Run `pnpm install --frozen-lockfile`, copy `.env.example` to `apps/web/.env.local`, configure the Supabase publishable URL/key, then run `pnpm dev`. Open http://127.0.0.1:4310.

`LOCAL_DEVELOPMENT=true` plus `LOCAL_SYNTHETIC_TESTS=true` selects fictional localhost-only profiles with PGlite persistence in `apps/web/.data`. Never enable these flags on Vercel. Local fixtures and cloud accounts are separate. Restart after local schema changes.

## Hosting and identity

Web app: https://aldaconnect.fit. `www` redirects to the apex. Vercel project `fitness-workspace`, team `amuos-projects`, root `apps/web`, Frankfurt functions. The custom domain is publicly accessible with application authentication; preview deployment protection remains enabled. This is a development release, not a commercial or clinical launch.

Supabase project `fitness-platform`, ref `uyzxiyyjuijbfredvhpg`, Free plan, EU Ireland. Eight migrations are applied as of 8 October 2026. Apply migrations in filename order in a new project. All application tables have RLS. No service-role secret is used by the app. The private-records bucket has no object access policies; uploads remain unavailable.

Email users authenticate through Supabase with confirmation, resend and password-recovery flows. Bosnian HTML templates are in `supabase/templates`; `/auth/confirm` verifies token hashes after an explicit button press. Auth Site URL is the custom domain. Resend custom SMTP sends as Alda Connect / fitness@mail.aldaconnect.fit. The dedicated sending domain is verified and the integration key is restricted to it. Actual inbox delivery remains unaccepted; evidence is tracked in the parent project's BUILD-STATUS.md.

Two user-requested persistent username accounts exist: administrator Alda and client Amrudin. Credentials are not in this repository. Username sessions use an HttpOnly Secure SameSite cookie, random tokens stored hashed, server-side expiry, private bcrypt credential storage and failed-login throttling. Initial credentials should be changed through account settings before wider use. User signup cannot grant expert or admin roles. Admin client/trainer previews are read-only and SQL denies preview mutations.

## Implemented flows

Member login/signup, up to seven adaptive general onboarding steps, selectable module interests with later editing, six available modules (four core modules, private cycle diary and shared product records), assigned plan versions, workout sessions, rep and timed-set logs, completion, check-ins and expert review tasks, basic nutrition/recovery diary, coaching messages and trainer invitation tokens. Invitations can target an email or an existing username; links expire after seven days. Trainers copy/share invitation links; automatic trainer invitation email dispatch is not yet implemented.

Alda has a profile roster, read-only client and empty trainer previews, module availability and basic activity history. Amrudin's onboarding is left for him to complete. Advanced expert spaces remain in preparation.

The PWA manifest, icons, service worker and Bosnian installation instructions support home-screen installation for all roles. Installed users use the same backend. Private pages/API responses are not cached. An offline reconnect page is available; the existing opened-workout set queue supports later synchronization. General offline access and physical-device installation have not been accepted.

## Validation

`pnpm test`: 27 passing domain, persistence, isolation and migration checks. `pnpm typecheck` and `pnpm build` validate the app. `tests/live-supabase-smoke.sql` and `tests/live-username-smoke.sql` are rollback-only live database checks. Live username smoke passed with real pgcrypto and checked login, logout, client isolation and admin preview; test users were rolled back. Local crypto stubs do not prove cryptographic behavior.

Manual browser acceptance covers local coaching flows and expanded onboarding, plus live Alda/Amrudin sign-in and read-only admin preview on the HTTPS custom domain. Evidence is stored in the parent project's `deliverables/evidence/2026-10-08`. Actual inbox confirmation/recovery, live trainer invitation acceptance and physical mobile installation remain unaccepted.

## Remaining full-product work

Professional credential/organization onboarding, paid entitlements and regional merchant setup, independent program catalogue, scheduling/progression, full nutrition planning, private file scanning/upload lifecycle, cycle/rehab/labs/medication workflows, wearables, community, complete privacy lifecycle and native apps. Clinical activation requires qualified service ownership. No clinical or PED protocol advice is generated.


## Private cycle diary — 8 October 2026

Owner-only daily bleeding, optional pain/symptoms/notes, dated history, edit, recoverable removal and restoration are implemented. Cycle entries are fetched separately from coaching snapshots and excluded from trainer/admin previews. Authenticated data export includes the owner’s cycle entries. No predictions, automatic training changes or expert sharing is implemented. Migration 007 and rollback-only live-cycle smoke passed; local browser checks cover save, refresh and remove/restore.

Live device connections are deferred by the user. Medication, supplement and PED records must support both assigned doctors and trainers as editors, with client-granted access and visible creator/editor identity, timestamps and before/after history. This record module is implemented: explicit owner-granted access for assigned doctors/trainers, immutable named versions, optimistic concurrency checks, recoverable removal/restoration and owner export. Live rollback smoke verifies both expert roles, authorship, stale-edit rejection and revocation. Clinical prescribing, PED protocol recommendations and medication notifications are not implemented.
