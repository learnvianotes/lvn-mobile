# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- A new look: warm paper, ink blue and a highlighter yellow, IBM Plex Sans, and a new flat LVN app icon. [#53](https://github.com/learnvianotes/lvn-mobile/pull/53)
- Sign in with a 6-digit code sent to your email; a password is still one tap away. The assistant is called Nova. [#53](https://github.com/learnvianotes/lvn-mobile/pull/53)

### Fixed

- Uploads on a weak network no longer hang: a stalled upload is retried, quick notes upload two files at a time, and a PDF you just added opens by itself once its virus check finishes. [#53](https://github.com/learnvianotes/lvn-mobile/pull/53)

### Removed

- GitHub and LinkedIn sign-in. [#53](https://github.com/learnvianotes/lvn-mobile/pull/53)

### Security

- Every library is on its latest release that this Expo SDK supports, including Firebase 13 for Google sign-in, and the app knows about the newest parts of the API. Library updates now arrive as one weekly pull request instead of ten. [#52](https://github.com/learnvianotes/lvn-mobile/pull/52)

## [0.2.0] - 2026-11-15

Android `versionCode` 7.

### Added

- Share photos, PDFs, Word and PowerPoint files, text files and plain text into a note from other apps ([#41](https://github.com/learnvianotes/lvn-mobile/pull/41)).
- A versioning policy, so everyday changes are written down and the app version stays put until a release ([#40](https://github.com/learnvianotes/lvn-mobile/pull/40)).

### Fixed

- Retrying a share that only partly uploaded adds the rest to the same note ([#41](https://github.com/learnvianotes/lvn-mobile/pull/41)).

## [0.1.4] - 2026-11-12

Android `versionCode` 6.

### Fixed

- Code blocks scroll sideways in the note viewer ([#39](https://github.com/learnvianotes/lvn-mobile/pull/39)).

## [0.1.3] - 2026-11-12

Android `versionCode` 5. Prepared for the Google Play public release.

### Changed

- Sign-up minimum age is 13 ([#38](https://github.com/learnvianotes/lvn-mobile/pull/38)).
- Background audio playback is off.

### Removed

- Foreground-service, overlay, and legacy storage permissions.

## [0.1.0] - 2026-10-08

### Added

- First version recorded in git (`0.1.0` in `package.json` and `app.config.ts`). No Android `versionCode` was set. See git history for the work before 0.1.3.

0.1.1 and 0.1.2 (versionCode 4) are not identifiable as version bumps in this repository.

[0.2.0]: https://github.com/learnvianotes/lvn-mobile/releases/tag/v0.2.0
[0.1.4]: https://github.com/learnvianotes/lvn-mobile/commit/dbcdf737fdac4f6e55d2fb94a50b84679fe876c4
[0.1.3]: https://github.com/learnvianotes/lvn-mobile/commit/922282e05d3005c7efbb946e73f8f076715f7f78
[0.1.0]: https://github.com/learnvianotes/lvn-mobile/commit/916a5d51dbbd82b5dd569e1fac6e15fa95c21192
