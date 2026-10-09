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
