# Alda Connect

Original fitness and expert workspace. The approved full-product plan and backlog live in the parent project's `plans` directory. **The full product remains in development.** Product UI is Bosnian; technical documentation is English.

## Run locally

Use Node 24 and pnpm 11.25.0. Run `pnpm install --frozen-lockfile`, copy `.env.example` to `apps/web/.env.local`, configure the Supabase publishable URL/key, then run `pnpm dev`. Open http://127.0.0.1:4310.

`LOCAL_DEVELOPMENT=true` plus `LOCAL_SYNTHETIC_TESTS=true` selects fictional localhost-only profiles with PGlite persistence in `apps/web/.data`. Never enable these flags on Vercel. Local fixtures and cloud accounts are separate. Restart after local schema changes.

## Hosting and identity

Source repository: https://github.com/Kerim-Sabic/aldaconnect. Live app: https://aldaconnect.vercel.app. Vercel project: `aldaconnect`, team `kerimsabic-6594s-projects`, application root `apps/web`. The earlier `aldaconnect.fit` deployment is separate. This is a development release, not a commercial or clinical launch.

Supabase project `fitness-platform`, ref `uyzxiyyjuijbfredvhpg`, Free plan, EU Ireland. Ten migrations are applied as of 8 October 2026. Apply migrations in filename order in a new project. All application tables have RLS. No service-role secret is used by the app. The private-records bucket has no object access policies; storage-bucket uploads remain unavailable. Synthetic lab PDFs use authenticated RPC access to private database bytes (2 MB limit).

Email users authenticate through Supabase with confirmation, resend and password-recovery flows. Bosnian HTML templates are in `supabase/templates`; `/auth/confirm` verifies token hashes after an explicit button press. The shared backend currently uses the earlier custom domain for its Auth Site URL and email templates. The new Vercel host needs to be included in Supabase redirect URLs; changing the email destination requires access to that backend project. Resend custom SMTP sends as Alda Connect / fitness@mail.aldaconnect.fit. The dedicated sending domain is verified and the integration key is restricted to it. Actual inbox delivery remains unaccepted; evidence is tracked in the parent project's BUILD-STATUS.md.

User-requested persistent username accounts include administrator Admin, trainer Alda and client Amrudin; a visibly marked Dr Nabil test-doctor profile is provisioned separately for synthetic lab acceptance. Credentials are not in this repository. Username sessions use an HttpOnly Secure SameSite cookie, random tokens stored hashed, server-side expiry, private bcrypt credential storage and failed-login throttling. Initial credentials should be changed through account settings before wider use. User signup cannot grant expert or admin roles. Admin client/trainer previews are read-only and SQL denies preview mutations.

## Implemented flows

Member login/signup, up to seven adaptive general onboarding steps, selectable module interests with later editing, seven available modules (four core modules, private cycle diary, shared product records and synthetic labs), assigned plan versions, workout sessions, rep and timed-set logs, completion, check-ins and expert review tasks, daily calorie and hydration tracking, a seven-day calorie chart, reviewed barcode/QR product lookup, nutrition/recovery diary, coaching messages and trainer invitation tokens. Invitations can target an email or an existing username; links expire after seven days. Trainers copy/share invitation links; automatic trainer invitation email dispatch is not yet implemented.

Admin has a profile roster, read-only client/trainer/doctor previews, module availability and basic activity history. Alda is an active trainer assigned to Amrudin. Amrudin's profile now reports onboarding completed; his intake answers were not inspected. Advanced expert spaces remain in preparation.

The PWA manifest, icons, service worker and Bosnian installation instructions support home-screen installation for all roles. Installed users use the same backend. Private pages/API responses are not cached. An offline reconnect page is available; the existing opened-workout set queue supports later synchronization. General offline access and physical-device installation have not been accepted.

## Validation

`pnpm test`: 32 passing domain, persistence, isolation, migration and service-worker checks. `pnpm typecheck` and `pnpm build` validate the app. `tests/live-supabase-smoke.sql` and `tests/live-username-smoke.sql` are rollback-only live database checks. Live username smoke passed with real pgcrypto and checked login, logout, client isolation and admin preview; test users were rolled back. Local crypto stubs do not prove cryptographic behavior.

Manual browser acceptance covers local coaching flows and expanded onboarding, plus live Alda/Amrudin sign-in and read-only admin preview on the HTTPS custom domain. Evidence is stored in the parent project's `deliverables/evidence/2026-10-08`. Actual inbox confirmation/recovery, live trainer invitation acceptance and physical mobile installation remain unaccepted.

## Remaining full-product work

Professional credential/organization onboarding, paid entitlements and regional merchant setup, independent program catalogue, scheduling/progression, full nutrition planning, private file scanning/upload lifecycle, advanced cycle/rehab/labs/medication workflows, wearables, community, complete privacy lifecycle and native apps. Clinical activation requires qualified service ownership. No clinical or PED protocol advice is generated.

## Private cycle diary — 8 October 2026

Owner-only daily bleeding, optional pain/symptoms/notes, dated history, edit, recoverable removal and restoration are implemented. Cycle entries are fetched separately from coaching snapshots and excluded from trainer/admin previews. Authenticated data export includes the owner’s cycle entries. No predictions, automatic training changes or expert sharing is implemented. Migration 007 and rollback-only live-cycle smoke passed; local browser checks cover save, refresh and remove/restore.

Live device connections are deferred by the user. Medication, supplement and PED records must support both assigned doctors and trainers as editors, with client-granted access and visible creator/editor identity, timestamps and before/after history. This record module is implemented: explicit owner-granted access for assigned doctors/trainers, immutable named versions, optimistic concurrency checks, recoverable removal/restoration and owner export. Live rollback smoke verifies both expert roles, authorship, stale-edit rejection and revocation. Clinical prescribing, PED protocol recommendations and medication notifications are not implemented.

## Synthetic LabBridge doctor acceptance

Migration 009 adds a test-only lab workflow: PDF upload/download (2 MB), active assigned-doctor access with a separate client grant, immutable attributed review notes, and owner remove/restore. Admin previews fetch no private labs. The Nabil LabBridge report engine produces a conspicuously fictional sample with no signature/stamp; this is PDF export/import, not a live analyzer connection. Real clinical files, malware scanning, production storage lifecycle and structured-result integration remain pending. The marked doctor account is created through an authenticated administrator API which refuses to overwrite an existing username. No credentials or clinical files belong in Git.

## Mobile redesign and installed-app updates — 9 October 2026

The current design follows the user's mobile fitness references, with locally bundled Geist typography, a neutral canvas, deep green and lime accents, a new generated monochrome identity, compact calorie/water tiles, bottom sheets and floating phone navigation. Daily calorie history, a seven-day chart, recent-meal reuse and camera barcode/QR scanning are implemented. Packaged-food calories come from Open Food Facts and scale to the entered portion. Manual entry remains available; no OpenAI key is required. See `docs/nutrition.md` for setup, privacy and verification boundaries, `docs/design-assets.md` for generated artwork provenance, and `apps/web/DESIGN.md` for the visual system. Theme selection, role permissions and keyboard focus handling are preserved. Settings now includes an installation guide tailored to the device.

The public, no-store `/api/release` endpoint supplies a build-specific release ID. Open apps check on focus, reconnection, visibility and every five minutes. A new version offers an explicit update; active workouts, queued sets, saves and workspace dialogs block reload. Other unsaved forms require saving before the confirmation. Closed apps receive current network content when reopened. Private responses remain uncached. Actual physical iOS/Android installation and cross-deployment update-prompt acceptance remain outstanding.
