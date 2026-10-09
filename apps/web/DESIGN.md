# Alda Connect · mobile product system

The 9 October 2026 direction follows the user's supplied phone references: light, precise typography; compact grouped information; deep green workout surfaces; selective lime accents; rounded bars and controls; and a floating bottom navigation. Linear, Vercel and Stripe inform the restrained navigation and typography. Bosnian remains the product language.

Geist Sans is bundled locally through the official geist package. Headings use weight 450, supporting labels 11–13px, and phone fields 16px. The light canvas is #f5f5f5 with white surfaces and #17191a text. Deep surfaces use #182522; lime is #dfff85. Dark mode maps the complete semantic palette and retains contrast for all actions. Brand artwork is an original monochrome lowercase a generated with ImageGen.

`globals.css` retains structural and legacy specialist rules, `interface.css` retains common role components, and `mobile-first.css` defines the current product presentation and phone adaptations. Use semantic tokens rather than adding new hard-coded role palettes.

The phone home screen starts with calendar context and the assigned workout. Quick actions lead directly to meal capture and check-in. Calories and hydration form two compact tiles, with team messaging and recorded activity below. All figures come from recorded data. Workout counts use assigned exercises and saved sets; no fixed duration or fabricated health score is displayed.

Nutrition is a primary bottom-navigation destination. It provides manual calorie entry, recent-meal reuse, on-device barcode/QR scanning, reviewed product lookup, daily history, water logging and a seven-day chart. Details and setup are in docs/nutrition.md. Product lookup uses Open Food Facts without an API key. Manual tracking remains available for unpackaged or missing foods.

Dialogs become bottom sheets on phones, with focus trapping, Escape dismissal, background scroll locking and trigger restoration. The floating navigation and sheets respect device safe areas. Fields and buttons retain accessible labels and minimum touch sizes. Motion respects reduced-motion settings.

The PWA uses the new logo at all icon sizes, standalone display, matching browser chrome, an install entry in settings and platform-specific guidance. Already installed apps suppress the install prompt. Private documents/API responses remain uncached. Only opened workout set logging currently supports queued offline writes; new meals require a connection.

Desktop uses a quiet 224px rail and a two-column daily workspace; narrow desktop and phone layouts reflow without horizontal scrolling. Specialist, admin, onboarding, settings and authentication surfaces inherit the same typography, neutral palette and rounded controls.

The public landing page uses the same identity on a warmer ivory canvas, with one generated architectural photograph and the existing program covers. Landing styles are scoped in `landing.css`. `navigation-catalog.css` adds grouped menus, product catalog forms, the three-step onboarding and in-context group invitation panel using existing workspace tokens. Member/admin overview styling is retained.
