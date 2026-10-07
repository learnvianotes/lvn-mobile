# lvn-mobile

The LearnViaNotes app for Android and iOS — Expo SDK 57, Expo Router, TypeScript.
Architecture: lvn-backend `docs/architecture/lvn-architecture-v2.md` (the single source of truth for all three
repositories) and this app's [mobile addendum](docs/architecture/mobile-addendum.md).

Phase 0: a start screen and the three build variants. Accounts, notes and offline sync arrive in Phase 1–2.

## Develop

Requires Node 22 and pnpm 10 (`node-linker=hoisted`, see `.npmrc`). Add packages with `npx expo install <pkg>`
so versions match the SDK. Variant values live in `env/<variant>.env`; put personal overrides (for example your
machine's address) in `env/<variant>.local.env`.

```bash
pnpm install
pnpm start                     # Expo dev server (development variant)
pnpm lint && pnpm typecheck && pnpm test
pnpm doctor                    # SDK version and config checks
pnpm export:check              # bundle JS for Android and iOS
```

## Builds — no Expo account needed

```bash
pnpm android                                   # debug build on a connected phone/emulator, live reload
pnpm build:android sandbox                     # standalone APK → dist/LearnViaNotes-sandbox-<version>.apk
pnpm build:android development --abi arm64-v8a # faster: one CPU architecture
adb install -r dist/LearnViaNotes-sandbox-0.1.0.apk
```

Needs the Android SDK and JDK 17+. iOS builds need a Mac with Xcode (`pnpm ios`). Details and signing:
[mobile addendum](docs/architecture/mobile-addendum.md) and lvn-backend ADR-0008.
