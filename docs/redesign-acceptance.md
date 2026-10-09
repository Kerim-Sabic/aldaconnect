# Redesign acceptance — 9 October 2026

## Scope

Second redesign follows the supplied mobile fitness references: locally bundled Geist, neutral canvas, deep green/lime accents, new generated monochrome identity, compact daily dashboard, floating phone navigation and bottom sheets. Shared styling covers client, trainer, admin, doctor, authentication, forms, dialogs, settings and offline surfaces. Existing permissions and workflows are retained.

Calorie tracking adds manual entries, recent meals, daily history, seven-day chart, hydration and reviewed packaged-food barcode/QR lookup. No OpenAI credential is required. New install guidance handles Apple and other browsers; icons, standalone manifest, safe areas and public offline fallback match the identity. Private pages and APIs remain uncached.

## Automated verification

- 49 tests pass across nine files, including existing authorization/persistence checks and new nutrition/barcode tests.
- TypeScript and optimized Next.js production build pass; 16 routes, including nutrition product lookup.
- New dependencies are locally bundled Geist and the lazy-loaded ZXing browser reader.

## Browser verification

Fictional localhost fixtures were used for responsive dashboard/nutrition/workout/settings at 390px and 320px, desktop at 1440px, light/dark appearance, manual meal persistence, daily history, hydration, installation help, drawer and dialog behavior. Real Open Food Facts staging lookup recognized Nutella at 539 kcal/100g; 15g calculated 81 kcal and 30g calculated 162 kcal. No private cloud record was changed.

## Boundaries

Physical phone camera scanning and iOS/Android home-screen installation require device acceptance. This release does not activate billing or deferred clinical modules. The new source repository is Kerim-Sabic/aldaconnect; the old custom-domain deployment is separate.

## Hosting verification

Pushed main to `https://github.com/Kerim-Sabic/aldaconnect` (application commit f55883e). The new `aldaconnect` Vercel project is linked to that repository under kerimsabic-6594s-projects, with Next.js and root apps/web. Production deployment dpl_HkrJg14bM7Jwd5egxLzcteL5q66w reached Ready in 1m 2s at https://aldaconnect.vercel.app. Cloud configuration, release identity, standalone manifest and public sign-in rendering were verified. Existing Supabase publishable settings were configured for all Vercel environments; local fixture flags were not enabled.

The connected browser account cannot access the existing Supabase backend dashboard. Its email templates still use the earlier Site URL, so email confirmation/recovery destination changes remain a backend-owner task. Existing username sign-in uses the same backend. No live user credential or private record was used for QA.
