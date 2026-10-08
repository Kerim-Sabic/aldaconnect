# Fitness platform

Original fitness and expert workspace, implemented under the approved full-product plan in `../plans/BUILD-PLAN.md`. **The full product remains in development.** The interface is Bosnian; project communication and technical documentation are English.

## Run locally

Use Node 24 and pnpm 11.25.0. Run `pnpm install --frozen-lockfile`, copy `.env.example` to `apps/web/.env.local`, fill the Supabase publishable URL/key, then run `pnpm dev`. Open http://127.0.0.1:4310.

`LOCAL_DEVELOPMENT=true` plus `LOCAL_SYNTHETIC_TESTS=true` selects fictional localhost-only profiles with PGlite persistence in `apps/web/.data`. Never set these flags on Vercel. Restart the development server after a local schema change. Local fixtures and cloud accounts are separate.

## Supabase and Vercel

Cloud project: `fitness-platform`, ref `uyzxiyyjuijbfredvhpg`, EU Ireland, Free plan. Apply SQL files in `supabase/migrations` in filename order to an empty development project. The four current migrations were applied on 8 October 2026. No real accounts or health records were imported. The private storage bucket has no object access policies yet; document uploads remain unavailable.

Vercel project: `fitness-workspace` in `amuos-projects`, with `apps/web` as root directory and Frankfurt functions. Configure only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Privileged Supabase secrets are not used by the app. Auth identities are validated server-side; database functions check ownership/active assignments and table reads use RLS. Signup metadata cannot grant professional roles.

Review URL: https://fitness-workspace-amuos-projects.vercel.app. Vercel labels the stable-alias deployment target `production`; this is a protected development review, not a commercial/clinical launch. Deployment protection is enabled. Email confirmation redirects to the exact `/auth/callback` URL on that host. General email delivery, password recovery, expert verification and live billing remain release work.

## Validation

`pnpm test` runs 19 domain, database, isolation and migration checks. `pnpm typecheck` and `pnpm build` validate the app. `tests/live-supabase-smoke.sql` is a rollback-only live SQL check; its verified run passed with zero persistent cloud accounts and RLS enabled on every application table. Its inserts never send email.

Browser acceptance evidence is in `../deliverables/evidence/2026-10-08`. Tested locally: client set recording, check-in to trainer review, plan-version preservation, timed holds stored separately from reps, workout completion and Bosnian screens. Email confirmation through an actual inbox, cloud expert signup, payment processing, device sync and clinical workflows have not been accepted. The Playwright command is reserved for future automated browser coverage; current browser acceptance was manual through the in-app browser.

## Current boundaries

Implemented first slice: member signup/sign-in integration, configurable modules/intake, assigned plans and immutable versions, separate workout sessions, rep/duration logs, check-ins and linked review tasks, basic diary, coaching messages and email-matched invitation tokens. The local fixture switch is absent from cloud UI.

Not complete: paid entitlements, self-guided program catalogue, expert credential/organization onboarding, appointments, full nutrition planning, private file scanning and upload lifecycle, cycle/rehab/labs/medication workflows, device integrations, community, full privacy lifecycle, native apps and operational release gates. Planned modules are visibly unavailable. No clinical or PED protocol advice is generated.
