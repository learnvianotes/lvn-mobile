# Web and mobile parity

Web reference: LearnViaNotes web `ui-revamp` (pull request 23). Normative copy and tokens: `DESIGN-SPEC.md` and `tokens.json` in this folder.

Mobile routes differ from the web paths. The table uses the mobile route. “Same” means the same English strings, the same four data states (skeleton, failure with Try again, the screen’s empty sentence, content), and the same tokens.

## Theme

Every row is required. Brand colours are the `accent.themes` light and dark slots in `tokens.json`, merged onto `color.light` and `color.dark`. Navy’s slots are empty, so Navy is the base (`#1e4d8c` light, `#9dc0ea` dark).

| Item | Web | Mobile |
| --- | --- | --- |
| Mode | System (default), Light, Dark | Same. System follows the phone. Missing key means System. |
| Accents | Navy (default), Teal, Forest, Slate, Amber | Same five, same ids, labels from `tokens.json`. Unknown id falls back to Navy. |
| Light and dark brand | Each accent overrides brand, brandHover, brandForeground, brandSoft, and codeTitle for both schemes | `resolvePalette` merges those partials onto the base. Replacing `tokens.json` is the whole change. |
| Contrast | Text pairs at least 4.5:1 | Unit test requires 4.5:1 for brand on brand-foreground, paper, surface, and brand-soft, plus ink and inverse pairs, for all 10 combinations. Purple and pink hues fail the test. |
| Where | Appearance picker | Top bar control named “Appearance” (public header and home bar) opens it. Profile shows the same picker on the page. Settings keeps it too. Close is “Close”. |
| Storage | Device only. `cnote:theme` is JSON `"system"`, `"light"`, or `"dark"`. `cnote:accent` is JSON `"navy"`, `"teal"`, `"forest"`, `"slate"`, or `"amber"` | Same key names and JSON values. Nothing is sent to the API. |
| First paint | Choice is applied before the first paint | The root reads both keys synchronously and sets the palette before the first screen renders, so a saved theme is not preceded by Navy or the other scheme. |
| Engine | `localStorage` | Same `localStorage` API. On web that is the browser. On iOS and Android, `expo-sqlite/localStorage/install` provides it (a no-op on web). Secure Store cannot hold these keys: a colon is not a legal key character there. |

## States

| Web state | Mobile | Difference |
| --- | --- | --- |
| Session unknown: skeleton, “Loading…”, no redirect | Same, inside the root frame, until restore finishes | — |
| Session unreachable after 8s or a network error on the first check. Sentence “LearnViaNotes did not answer. Check your connection and try again.” No redirect to sign-in | Same sentence and Try again if restore is still running after 8 seconds | A stored refresh token that fails or times out still opens the app offline, so notes on the phone stay available. Web has no on-device note store. Catalogue and other GraphQL calls still abort at 8 seconds and use Try again. |
| Signed out on an app route redirects to `/sign-in?next=` | The signed-out guard shows the public landing, which is the auth group’s first screen | `next` is not in the URL. Deep links to app screens while signed out land on the marketing screen, not a half-loaded app screen. |
| Query loading with no data: skeleton, not an empty well | `LoadState` does this | — |
| Query failed, no data: “This could not be loaded.” and Try again | Default failure copy matches. Screens that name the thing (“Your exams could not load.”) keep that sentence | — |
| Query ok and empty: that screen’s sentence | Unchanged, except Subjects | — |
| Missing public subject: real 404 | Slug absent from a loaded catalogue uses the 404 copy and “Go home” | — |
| Catalogue failed: heading “Subjects” and “Subjects could not load just now. Try again in a moment.” | Same. Not a 404 | — |

## Screens

| Web | Mobile | Status |
| --- | --- | --- |
| `/` landing, public header, eyebrow, h1 with “Brighter Tomorrow” in brand, lead, Get Started Free, Sign in, Browse subjects, illustration “A note, flashcards and a question answered”, six tiles | `Welcome` at `/` while signed out | Same column. Tiles and Browse subjects open sign-in, because those routes are inside the signed-in guard (see Deferred in AUDIT). “Continue with Google” is on this screen only when the API offers Google, so a returning account is still one tap. |
| Signed-in landing: “Open your home”, no Get Started | Signed-in `/` is Home | There is no second marketing page once signed in. |
| `/sign-in` inverse banner and sheet | `(auth)/sign-in` | Same heading, lead, fields, errors, forgot link, and “New to LearnViaNotes? Create an account”. Provider buttons only when configured. |
| `/sign-up`, details, verify, reset | Same screens, same field labels and the existing age confirmation | They share the inverse banner. Details still says “Almost there”. |
| `/subjects` | `/subjects` | Same h1, lead, cards, failure, and 404. Signed-in only. Topic chips open that topic in Explore. |
| `/subjects/[slug]/[topic]` public notes | Explore filtered by topic | Mobile has no separate public-note topic page. |
| `/resources` | `/resources` | Same shell tokens and load states. Filters were already there. |
| `/n/[slug]` public note | Not a route | Opening a note uses `/notes/[id]` once signed in. |
| `/u/[handle]` | `/u/[handle]` | Same profile screen. Empty and error sentences were already the screen’s own. |
| Legal and unsubscribe | Footer links on the landing open the web paths | No in-app legal reader. |
| `/home` greeting, daily line, continue, exam, rhythm | Home tab | Greeting copy stays “Keep learning, {first name}” (or “Keep learning”), which is the heading. The daily line is the body when it arrives, not a second h1. Cards use navy, teal, and amber, not pink. |
| `/notes` inverse greeting | `/notes` | List, filters, and offline behaviour kept. Stripe colours are navy, teal, forest, amber, and slate. The editor document model was not restyled. |
| `/search` dialog | Explore, opened from the home search field | Field name matches the spec. Explore’s own label stays “Search notes, people, groups and topics”. |
| Groups, classes, exams, quizzes, contests, rhythm, community, ask, bookmarks, review | Menu entries to the existing screens. Quizzes is `/review`. Groups and Classrooms open Community → Groups & classes. Bookmarks is `/saved` | Same labels and order as the web sidebar. Empty and error sentences on those screens were already their own. Contest hero is the inverse “Weekly” panel. |
| Profile, skills, notifications, achievements, history, teach | Profile tab and the screens behind it | Profile shows Appearance (mode and accent) under the title. Settings keeps the same picker. Skills still waits for the profile query. Achievements keep real points; the contributor badge is teal, not pink. |
| Admin | `/admin/moderation`, `/admin/verification` | Not restructured. They use the new tokens. |
| `/core` reader | Not in this app | — |
| App shell: skip link, sidebar from 1024, drawer below | Menu drawer (name “Menu”, close “Close the menu”) plus the thumb bar | No skip link and no persistent sidebar: the phone is always under 1024. Thumb bar remains Home, Explore, Create, Community, Profile. |
| Public header: Browse below 768, not named Menu | Browse button, menu title Browse, close “Close” | Features scrolls to “What you can do”. Subjects, Community, Resources, and Get Started follow the signed-out rule above. |
| Wordmark to `/` or `/home` | Wordmark to `/`, label “LearnViaNotes”. “Notes” is brand | `/` is the marketing screen or Home, depending on the session. There is no `/home` route. |

## Intentional platform differences

- Thumb bar plus Menu, instead of a sidebar that becomes a drawer.
- Offline open when a refresh token is already on the device.
- Signed-out deep links open the landing rather than `/sign-in?next=`.
- Home greeting is “Keep learning”, not a clock greeting, so the daily line stays the sentence under one stable heading.
- System font instead of bundled Inter.
- Legal documents open on the web origin.
