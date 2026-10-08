---
name: Alda Connect
description: A calm, precise coaching workspace with system typography and a restrained evergreen accent.
colors:
  paper: "#f5f6f8"
  surface: "#ffffff"
  ink: "#1d2228"
  muted: "#666f78"
  line: "#e2e5e9"
  accent: "#246749"
  accent-soft: "#e8f1ec"
  workout: "#173d30"
  dark-paper: "#111315"
  dark-surface: "#1c1f22"
  dark-ink: "#f0f3f5"
  dark-muted: "#a1a9b1"
  dark-line: "#33393e"
  dark-accent: "#a4dec0"
---

# Alda Connect interface

The current redesign replaces the previous ivory, espresso and bronze direction at the user's request on 8 October 2026. The visual thesis is a quiet, precise daily coaching workspace: soft neutral surfaces, native system typography, a restrained evergreen accent, deliberate spacing and useful recorded activity. The app remains Bosnian. Styling does not imply payment, clinical readiness, or completion of deferred capabilities.

## Theme and typography

`app/globals.css` supplies the existing structural rules. `app/interface.css`, imported afterward in the root layout, owns the current semantic theme and component presentation. The previous club stylesheet has been removed to avoid conflicting visual systems. Existing locally hosted font files are preserved but no longer loaded.

Use the existing semantic variables for both themes. Paper, surface, subtle, ink, muted and line always move together. Accent becomes a light mint in dark mode; primary action text becomes dark. The workout feature deliberately retains its forest-green surface and high-contrast pale action in both themes. System/light/dark choice continues to persist locally. Viewport and manifest colors match the light canvas; the theme control updates the browser chrome when the selected appearance changes.

The system stack is -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif. Display headings are compact and confident, with no serif decoration. Body copy defaults to 16px; primary interface labels and controls are generally 14px; supporting metadata is 11–13px. Fields stay at 16px on phones. Keep numeric summaries and set inputs tabular. Never introduce invented scores, recovery percentages or health outcomes.

## Layout and hierarchy

Desktop has a light 248px navigation rail, a quiet 76px utility header, and a content region capped at 1440px. The daily workspace uses a main column plus a 300px supporting column. At intermediate widths the supporting panels form two columns below the primary activity; phones stack them. Main actions remain part of the working screen.

The workout feature contains the assigned plan, start/resume action, progress ring from saved sets, exercise preview and author. Recorded activity below it uses the actual completed sessions, logged sets and submitted check-ins. Habit controls, calendar context and coaching messages remain secondary. No chart or score uses fabricated data.

The sign-in screen uses one compact editorial fitness photograph beside the existing sign-in, registration and synthetic preview flows. On phones the image is omitted to bring the form into reach. The photograph is decorative; no portrait implies an expert endorsement.

Client and trainer phones retain four daily destinations plus More. Selected destinations have visible and semantic active states. The additional drawer holds the remaining modules and settings. A closed mobile drawer is hidden from focus and accessibility traversal. Open drawers trap keyboard focus, close with Escape, restore focus and prevent background scrolling. Workspace dialogs use the same behavior, except mandatory onboarding cannot be dismissed. Selecting a workspace view returns to the top and focuses its main region.

## Surfaces, controls and motion

Content surfaces use 18–24px corners, one-pixel semantic borders and very light elevation. Buttons and fields use 12px corners and 44–48px minimum targets. Forms keep visible labels, existing validation, busy states, and disabled states. Native inputs and selects remain native. Switches retain a larger hit target around their compact visual track.

Use one restrained accent per task. Status messages include readable text. White, mint and graphite surfaces distinguish content without gradients, ornamental charts or decorative section counters. Messages, operational queues, private records, admin cards and doctor tabs share the same tokens.

Ordinary transitions remain short. Page sections enter with a five-pixel, 260ms movement; dialogs use 220ms. Drawer movement uses 260ms. Progress arcs animate only when their actual value changes. Reduced-motion preference disables transitions, animation and smooth scrolling. Bottom controls, dialogs and notices respect mobile safe areas.

## Identity and installed app

The new vector A mark and lowercase Alda Connect wordmark appear throughout the interface. Favicon, 180px Apple icon, 192/512px PWA icons and maskable icon use the same mark. The maskable asset uses a full solid background and a centered safe-area glyph. The standalone offline screen uses the same typography, palette and controls and follows system appearance.

Service-worker cache `fitness-public-v3` refreshes the redesigned offline page. It still caches only the public offline document, never private records or API responses. Existing build-aware update notices and protection of active workouts, queued sets and unsaved work are preserved.

## Product boundaries

Preserve the existing authentication, onboarding, invitations, workout sessions, diary, messaging, owner-only cycle entries, attributed medication records and synthetic lab workflows. Keep read-only admin previews and privacy notices visible. No permission, schema, payment, clinical advice or backend behavior is added by this redesign. Deferred modules stay visibly unavailable.

Local browser QA is evidence of interface behavior with synthetic fixtures. It does not establish real inbox delivery, live clinical readiness, physical-device installation, or live cross-deployment update acceptance.
