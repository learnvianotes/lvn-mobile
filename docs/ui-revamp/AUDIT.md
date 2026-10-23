# Mobile UI audit

Audit of LearnViaNotes on `main` before the `ui-revamp` branch, then what this branch changed. Severity is how badly it broke the study UI or blocked parity with the web spec in `DESIGN-SPEC.md`.

Tokens and accents live in `tokens.json`. The app reads that file; it does not hard-code swatches.

## Critical

None. The app loaded, signed in, and kept its API calls.

## High

| Issue | Where | What changed |
| --- | --- | --- |
| Palette was a different blue (`#2563eb` / `#60a5fa`), not the spec navy, ink, and paper | `global.css`, `lib/theme.ts` | Base colours are the file’s `color.light` and `color.dark`. Accent themes override brand slots only. |
| No appearance control and no accent themes. Uniwind followed the OS with no saved choice | top bar, Profile, settings | Mode is System (default), Light, or Dark. Accents are Navy, Teal, Forest, Slate, Amber, from `tokens.json`. Keys `cnote:theme` and `cnote:accent` (JSON), on device only, read before the first screen. |
| Pink and rose in the product UI | recommendations, community cards, note stripes, the contributor badge, the notification dot, quick actions | Those surfaces use navy, teal, amber, or forest from the palette. `--color-rose` is danger, so old class names are not pink. |
| Indigo focus gradient (`#0f0c29`) and a starry home hero | Focus, Home | Both are flat inverse panels with a brand strip. No glow on the create button. |
| Spark mark on the in-app logo | `Logo` | The tile is a flat brand rect. The spark path is not drawn. Store icons were not regenerated. |

## Medium

| Issue | Where | What changed |
| --- | --- | --- |
| Signed-out home was a full-bleed gradient with a bottom sheet | Welcome | Public header, one column, the spec heading, lead, actions, illustration, and six equal tiles. |
| Auth screens were a plain form under the wordmark | sign-in, sign-up, reset, details, verify | Public header, inverse banner, form sheet overlapping by 24px. Chips from 640px wide. |
| Loading was a spinner. Failure copy did not match the spec | `LoadState` | “Loading…” plus three bars (16, 16, 96). Default failure is “This could not be loaded.” with Try again, disabled while the retry runs. |
| Subjects treated a failed catalogue like a missing page, and the miss was not a 404 | Subjects | Failure keeps the Subjects heading and “Subjects could not load just now. Try again in a moment.” A slug missing from a successful list is “Page not found.” / “This page does not exist or is no longer public.” / “Go home”. |
| Requests could hang past 8 seconds | session refresh, Apollo | Both use an 8 second deadline. If launch is still restoring after 8 seconds, the screen says “LearnViaNotes did not answer. Check your connection and try again.” |
| Icon buttons and the `sm` button size dropped under 40px | back buttons, button sizes | Back, theme, menu, and icon buttons are at least 40px. Default buttons are 44px tall, large buttons 48px, radius 14. |
| Inputs were 40px with a small radius | `Input`, auth fields | Height 44, radius 14, danger border when invalid. |
| Home search and the account control did not use the spec names | Home header | Search is “Search notes, topics, people, or ask AI…”. The avatar is “Your account”. |
| Most destinations were only reachable by remembering a tab or a profile row | Home | Menu lists the web sidebar in the same order. |

## Low

| Issue | Notes |
| --- | --- |
| Contest card said “Weekly contest” on a hard-coded navy | Eyebrow is “Weekly”. The panel uses inverse, the trophy uses the dark-theme amber so it stays visible on ink. |
| Quick actions used a different tint per tile | Every well is brand-soft with a brand icon. |
| Page titles used extrabold in a few app screens | Marketing and the home greeting stay extrabold. App titles in the screens we touched use bold. |
| Empty wells were plain muted lines | Subjects uses the dashed well. Other screens keep their own sentences. |

## Checked and left as they were

- Keyboard: auth screens still scroll inside `KeyboardAvoidingView`.
- Font scale: nothing sets `allowFontScaling` to false, so the system size still applies.
- Lists: notes stay on `FlatList`. This pass did not virtualise screens that were already short.
- Offline notes: a stored session still opens when the refresh fails, so the phone copy stays usable. See PARITY.
- API operations, GraphQL documents, and validation were not changed.

## Needs backend

None. Public subjects while signed out is a navigation-guard limit, not an API limit. It is under Deferred.

## Deferred

- Subjects, Community, and Resources stay behind the signed-in guard. Putting them outside that guard made `/subjects` the fallback screen and broke sign-in. The public Browse actions open sign-in instead. A public route group that is not the initial route would close this.
- Legal pages are not in the app. The landing footer opens the same paths on `EXPO_PUBLIC_WEB_URL`.
- Inter and JetBrains Mono are not bundled. UI text uses the system sans; the type scale and weights match the tokens.
- Skeleton bars do not shimmer. They stay a fixed size, which is the reduced-motion behaviour, on every device.
- The reader (`/core`) is not a screen in this app.
- Admin screens were not restructured. They inherit the new tokens.
- The four-item thumb bar (Home, Explore, Create, Community, Profile) stays. The Menu is the full list, so the thumb bar is a shortcut rather than a second product.
