# NFC App — e-visiting cards that you can actually find again

Capture any card (paper via OCR, QR, NFC tag, link, NameDrop/Tap to Share via the contacts inbox), auto-tag when/where/event, and find it later with fuzzy search. Share your own card with anyone — no app needed on their side.

- Spec: `docs/superpowers/specs/2026-10-04-ecard-app-design.md`
- Plan: `docs/superpowers/plans/2026-10-04-ecard-app-v1.md`
- Founder setup & launch runbook: `docs/SETUP.md`

## Stack
Expo SDK 57 (React Native, TypeScript, Expo Router) · React Native Firebase (Auth, Firestore offline, Storage, App Check, Functions, Analytics, Crashlytics) · Firebase Hosting fallback page · ML Kit OCR · AdMob native ads.

## Develop
```
npm install
npm test               # unit tests (parsers, search, inbox, follow-ups, ads, data layer)
npm run test:rules     # Firestore/Storage rules against the emulator (needs Java 21+)
npm run typecheck && npm run lint
npm start              # needs a dev build — see docs/SETUP.md §3
```
