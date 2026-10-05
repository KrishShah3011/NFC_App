# v1 build report

**Date:** 2026-10-05
**Repo:** https://github.com/KrishShah3011/NFC_App (`main`)

The whole v1 app is written and pushed, and CI passes on GitHub. It has never run on a phone or in an EAS build yet, because there's no Firebase project, no developer accounts and no Android SDK on the build machine.

## What was verified

| Check | Result |
|---|---|
| Type check and lint | pass |
| Unit tests (QR/vCard parsing, OCR accuracy gate, search, contacts inbox, follow-ups, ad rules, offline saving, profile sanitising) | 46/46 |
| Security rules, run against the local Firebase emulator | 7/7 |
| `expo-doctor` (Expo's project health check) | 21/21 |
| Android bundle of every screen (`expo export`) | builds |
| Android native project generated from the config (`expo prebuild`) | works: app links, NFC, contacts and AdMob show up in the manifest |
| GitHub Actions CI | green |

## How it went

- A 13-task plan was written and reviewed by Codex before building. Codex found 1 serious and 4 medium issues, all fixed in the plan first:
  - reminders never asked for notification permission
  - reminder rescheduling could double-schedule
  - a double tap could create two public profiles
  - cards scanned offline never reached phone Contacts
  - large card photos retried their upload forever
- An automatic security review of each commit flagged more problems during the build, all fixed with tests:
  - A malformed QR code could crash the scanner.
  - A contact name could inject extra lines into the exported contact file.
  - Other users' profile data was trusted as-is.
  - A profile photo hosted in someone else's Firebase account could log viewers' IP addresses.
  - Any web link could silently add a card and a phone contact. Links from outside the app's own scanner now need one tap to save.
  - A crafted link could make the app read files from its own storage.
- GitHub CI failed once because the lockfile generated on Windows didn't work on Linux. That was fixed, and the outdated workflow actions were updated.

## Changes from the spec

- A link opened from outside the app's own scanner (a web page, the phone camera, an NFC tag) now shows a one-tap Save screen instead of saving instantly. Only the in-app scanner saves with no tap.
- Your Android phone acting as an NFC tag for iPhones is still planned for v1.1, as the spec says.
- The account-deletion function has no automated test. It's on the manual checklist in `docs/SETUP.md` §6.
- The 30 test cards for paper-card scanning are realistic but invented. Add real anonymised cards over time.

## Before the first real build

All of these are in `docs/SETUP.md`:

1. Open company developer accounts with Apple and Google Play, plus Expo, two Firebase projects (dev and prod, Mumbai region) and AdMob.
2. Set up EAS environment variables and replace the placeholders (app name, bundle ID, Apple team ID, Android signing fingerprint, reCAPTCHA key, AdMob IDs). "NFC App" and `com.krishshah.nfcapp` are working names; the bundle ID can't be changed after the first store upload.
3. Build a dev version and work through the real-device checklist.
4. The first iPhone build may fail to link pods. The fallback setting is written up in SETUP §3.
5. Get the legal review of the privacy policy and terms drafts.

## Note

This GitHub repo is public, so the spec and plan are publicly visible. The repo was scanned for secrets before pushing and none were found.
