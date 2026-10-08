---
name: Alda Connect
description: A private coaching club with editorial greetings and precise daily controls.
colors:
  paper: "#f6f3ed"
  surface: "#fffdf9"
  subtle: "#eeeae2"
  ink: "#292620"
  muted: "#70685e"
  line: "#ddd6cb"
  accent: "#805933"
  accent-soft: "#eadbc7"
  sage: "#e1e6db"
  deep-surface: "#292620"
  on-dark: "#faf6ee"
  rail-text: "#dbd3c6"
  success: "#42604b"
  workout-action: "#d7b388"
  workout-action-ink: "#241e17"
  dark-paper: "#191815"
  dark-surface: "#23211d"
  dark-subtle: "#2d2a24"
  dark-ink: "#f3eee5"
  dark-muted: "#c1b7a7"
  dark-line: "#494239"
  dark-accent: "#d9b384"
  dark-accent-soft: "#463724"
  dark-sage: "#303b30"
  dark-deep-surface: "#161512"
  dark-success: "#b7c9ab"
  dark-primary-ink: "#231c14"
typography:
  display:
    fontFamily: "Literata, Georgia, serif"
    fontSize: "clamp(38px, 5vw, 64px)"
    fontWeight: 450
    lineHeight: 1.13
    letterSpacing: "-0.03em"
  greeting:
    fontFamily: "Literata, Georgia, serif"
    fontSize: "clamp(29px, 3vw, 42px)"
    fontWeight: 450
    lineHeight: 1.2
    letterSpacing: "-0.03em"
  title:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "19px"
    fontWeight: 650
    lineHeight: 1.35
    letterSpacing: "-0.025em"
  body:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "15px"
    lineHeight: 1.55
  control:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "13px"
    fontWeight: 600
  input:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "16px"
rounded:
  control: "8px"
  navigation: "10px"
  supporting-card: "12px"
  default: "14px"
  workout: "16px"
  dialog: "18px"
  admin-card: "20px"
  pill: "50px"
spacing:
  compact: "6px"
  small: "8px"
  control-gap: "12px"
  regular: "16px"
  card: "20px"
  section: "24px"
  generous: "28px"
  greeting-gap: "32px"
  desktop-gutter: "36px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "13px 20px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "12px 18px"
  button-workout:
    backgroundColor: "{colors.workout-action}"
    textColor: "{colors.workout-action-ink}"
    rounded: "{rounded.control}"
    padding: "12px 18px"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.input}"
    rounded: "{rounded.control}"
    padding: "12px 13px"
  navigation-active:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.navigation}"
    padding: "13px"
  status-success:
    backgroundColor: "{colors.sage}"
    textColor: "{colors.success}"
    rounded: "{rounded.pill}"
    padding: "6px 10px"
  supporting-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.supporting-card}"
    padding: "20px"
---

# Design System: Alda Connect

## Overview

**Creative North Star: "The Private Coaching Club"**

Ivory work surfaces, espresso navigation and restrained bronze actions express the user-approved mix of Private Health Club, Club Identity and Precision Performance. Editorial greetings introduce a calm workspace; familiar sans-serif controls and tabular figures support daily action. Bosnian is the product language.

Clients work through daily training and supporting tools; Alda is a trainer, Admin oversees the platform and enters read-only previews, and doctors work with permitted private records. These roles share a visual vocabulary while preserving their context and permissions. This document records implemented source on 8 October 2026, with club.css loaded after globals.css. The finish verdict covers six corrections; whole-product completion, measured preview fidelity and physical-device PWA acceptance are outside that verdict.

**Key Characteristics:**

- Warm paper and espresso surfaces with bronze actions.
- Editorial greetings, precise controls and aligned numeric data.
- Compact summaries, readable queues and persistent mobile navigation.
- Explicit light, dark and system appearance choices.

## Colors

The palette uses warm neutrals with bronze action emphasis and sage success states. Frontmatter owns the exact light and dark values; CSS aliases white, border, dark and peach resolve to the corresponding semantic tokens.

### Primary

- **Bronze:** accent identifies primary actions and focus. Dark mode uses its lighter counterpart and dark-primary-ink for button text.
- **Warm bronze:** workout-action stays warm and light on the espresso workout feature in both themes.

### Secondary

- **Sage:** sage and success pair a soft status background with readable status text; dark variants preserve that relationship.

### Neutral

- **Ivory paper:** paper is the page canvas; surface holds work areas; subtle separates daily summaries and table headings.
- **Espresso:** ink is primary text, deep-surface anchors the rail and workout feature, and on-dark supplies their light text.
- **Warm stone:** muted handles secondary copy, line draws divisions, and rail-text supplies supporting copy on dark material.

**The Semantic Theme Rule.** Switch the semantic CSS variables together; preserve the fixed warm workout action and fixed ivory/espresso rail selection pairing. Theme selection persists as alda-theme and follows system appearance when Sistem is selected.

## Typography

Literata is self-hosted with Latin and Latin Extended coverage, variable weights 400–600 and swap loading. It supplies entry headlines, greetings and dialog titles, with Georgia as fallback. System sans-serif supplies body copy, controls, section titles and the workout title. The ALDA wordmark uses tracked sans-serif lettering; its small CONNECT line is identity typography, not a general label style.

The frontmatter records the recurring type roles. Workspace greetings become 31px/1.2 on mobile; entry display becomes 38px. Dialog titles use Literata at 28px desktop and 25px mobile. Supporting copy commonly uses 12–14px; section titles use 19px desktop and 18px mobile. Legacy admin section headings retain Georgia at 29px. Do not extend that exception into a new global display family.

**The Precision Rule.** Use tabular figures for metrics, time, tables and set entry. Keep the three trainer figures above their labels on mobile. Input text remains 16px, including dialog, exercise and set inputs.

## Layout

The workspace uses a fixed espresso rail (232px, reduced to 210px at 900px), a quiet utility header and a main region capped at 1440px. Desktop content has 36px side gutters and 28px top space. The daily grid uses a 1.85fr main column and a supporting column of at least 265px, with a 25px gap. Trainer summaries use a flat, divided strip and client glances use divided rows.

At 768px and below, the workspace margin disappears, main content uses 18px side gutters, and tools stack. A sticky 64px utility header sits above a fixed five-item bottom bar. Four role-specific destinations and Više provide daily access; the More drawer is at most 310px or 86vw. It includes a close button and top safe-area allowance. Active destinations carry aria-current; doctor's tabs carry aria-pressed. Admin navigation becomes horizontally scrollable and doctor tabs form two columns.

**The Reach Rule.** Buttons have at least a 44px height; icon buttons are 44px square, fields at least 46px high, and bottom navigation targets at least 58px high. The toggle's 52×44px target surrounds its 42×24px visual track. Mobile content reserves 128px plus the bottom safe area; bottom navigation also includes the safe-area inset.

Installation controls are in document flow after page content. Their final mobile padding reserves 96px plus the safe area. Installation help remains a fixed, scrollable overlay. Toasts and update notices clear bottom navigation; mobile dialogs remain centered with a 12px outer margin and maximum height of 100dvh minus 24px. Preview-banner desktop padding and rail offset keep the complete brand visible.

## Elevation & Depth

Most work surfaces use tonal separation and 1px borders. Summary strips and client rows stay flat. Dialogs retain a soft shadow (0 30px 100px #29262030) with a blurred backdrop; install help uses 0 12px 60px #29262020, and update notices use 0 12px 40px #0003. Flow-based install controls have no shadow.

**The Quiet Motion Rule.** Ordinary button state transitions use 160ms. The mobile drawer uses 240ms cubic-bezier(0.16, 1, 0.3, 1); bottom navigation colors use 180ms ease-out. Reduced-motion preference removes animations and transitions and restores automatic scrolling.

## Shapes

Controls use gently curved corners; supporting cards use 12px, the workout feature 16px, dialogs 18px desktop and 16px mobile, and admin cards 20px. Status pills and circular avatars retain their own silhouettes. Use 1px semantic line borders for fields, queues, panels and divisions. The workout's internal divisions use the fixed warm dark line #5a5042. No hard offset shadow vocabulary is established.

## Components

### Buttons

Primary bronze buttons use 13px control text, 13px 20px padding and at least 46px height. Secondary buttons use surface fill and a line border. Warm workout actions use 14px text and at least 48px height. Hover applies brightness(0.97); disabled buttons reduce opacity and use the disabled cursor. Focus-visible uses a 2px bronze outline offset 4px. These states resolve through the selected theme.

### Chips

Success chips pair sage with success text; neutral emphasis pairs accent-soft with ink. Pills use 11px text, 6px 10px padding and 50px corners. Text accompanies state color.

### Cards / Containers

Supporting tools use surface fill, 1px line borders, 12px corners and typically 20px padding. The dark workout feature uses 25px 28px top/side padding on desktop and 22px 20px on mobile. Trainer summaries and client rows use divisions without individual card shells. Medical record panels use 24px padding desktop and 20px mobile with 18px corners.

### Inputs / Fields

Default fields use surface fill, ink text, a line border, 8px corners, 12px 13px padding and 16px text. Medical and cycle fields retain 9–10px corners. Caret and focus use bronze. Keep visible labels and existing validation/disabled behavior; errors are not assigned a new palette by this document.

### Navigation

Rail navigation uses 13px text, 13px padding and 10px corners. Active rail items keep fixed ivory fill and espresso text in both themes. Mobile destinations use theme-bound accent-soft fill and accent text; labels remain visible with their icons. The theme control offers Sistem, Svijetlo and Tamno through an accessible select. Preserve explicit context and return controls in read-only previews.

### Brand and compact controls

The brand pairs a Literata lowercase mark inside a 40px rounded outline with tracked ALDA / CONNECT lettering. Use the brand as identity, not a decorative section counter. Compact module toggles center their thumb within the track while keeping the larger hit target.

## Do's and Don'ts

### Do:

- **Do** use semantic light/dark colors and visible focus treatment.
- **Do** keep 44px button targets, 16px field text and safe-area spacing.
- **Do** use tabular figures and readable queue rows for operational data.
- **Do** preserve Bosnian labels, role context and permission-bound private records.
- **Do** respect reduced motion and keep install controls in document flow.

### Don't:

- **Don't** restore decorative eyebrows, section counters or invented health metrics.
- **Don't** replace compact trainer summaries with unrelated metric-card decoration.
- **Don't** present preview images as measured specifications or synthetic reports as real clinical evidence.
- **Don't** infer whole-product or physical-device installation acceptance from the six-fix finish verdict.

Source scope: app/club.css, app/globals.css, app/layout.tsx, components/workspace.tsx, brand.tsx, theme-control.tsx, admin-workspace.tsx and doctor-workspace.tsx; PRODUCT.md and the app-page-tsx surface contract. Existing finish evidence: .impeccable/review/finish-review.md and verdict.md. Legacy smaller supporting text and retained Georgia admin section headings are observed exceptions, not a new reusable type scale; no UI repair is performed by this documentation pass.
