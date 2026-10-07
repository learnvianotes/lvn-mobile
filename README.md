# lvn-mobile

The LearnViaNotes app for Android and iOS — Expo SDK 57, Expo Router, TypeScript.
Architecture: lvn-backend `docs/architecture/lvn-architecture-v2.md` (the single source of truth for all three
repositories) and this app's [mobile addendum](docs/architecture/mobile-addendum.md).

Phase 0: a start screen and the three build variants. Accounts, notes and offline sync arrive in Phase 1–2.

## Develop

Requires Node 22 and pnpm 10 (`node-linker=hoisted`, see `.npmrc`). Add packages with `npx expo install <pkg>`
so versions match the SDK.

```bash
pnpm install
cp .env.example .env.local
pnpm start                     # Expo dev server; open in Expo Go or a development build
pnpm lint && pnpm typecheck && pnpm test
pnpm doctor                    # SDK version and config checks
pnpm export:check              # bundle JS for Android and iOS
```

## Builds

```bash
npx eas-cli@latest build --profile development   # LVN Dev, com.learnvianotes.dev
npx eas-cli@latest build --profile preview       # LVN Sandbox, internal distribution
npx eas-cli@latest build --profile production    # store build
```

EAS needs an Expo account and project id (`eas init`) — not set up yet.
