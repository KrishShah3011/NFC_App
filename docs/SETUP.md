# Founder setup and launch runbook

The code runs as soon as these accounts and keys exist. Everything here needs your own accounts, so it can't be automated from the repo. Work top to bottom.

## 1. Accounts (start now — long lead times)
- [ ] Apple Developer Program **as an organization** ($99/yr, needs a D-U-N-S number).
- [ ] Google Play Console **organization** account ($25). This skips the 12-tester/14-day rule for personal accounts.
- [ ] Expo account (`npx eas-cli@latest login`).
- [ ] Two Firebase projects: `nfc-app-dev` and `nfc-app-prod`. If an ID is taken, change it in `.firebaserc`.
- [ ] AdMob account. Create one Android and one iOS app, each with a **Native** ad unit.
- [ ] Domain (optional at launch). Until you have one, `<project>.web.app` works for links.
- [ ] Request Apple's **contacts notes entitlement** (com.apple.developer.contacts.notes) as soon as the Apple account exists. When it's granted, set `CONTACT_NOTES=1` in EAS env.

## 2. Firebase (repeat for dev and prod)
1. Create a **Firestore** database (Native mode) in **asia-south1 (Mumbai)**, and a Storage bucket in asia-south1.
2. Auth → enable **Phone**, **Google** and **Apple**.
   - Phone → **SMS region policy**: allow only India plus your list.
   - Dev only: add the test number `+91 99999 99999` with code `123456` (Maestro uses it).
3. Register apps:
   - Android: package `com.krishshah.nfcapp`, plus the SHA-256 from step 4.
   - iOS: bundle `com.krishshah.nfcapp`.
   - A **Web** app, which Hosting needs for `/__/firebase/init.json`.
4. Get the Android SHA-256 values from `npx eas-cli credentials` (and later from Play Console → App signing). Add them to Firebase **and** to `hosting/.well-known/assetlinks.json`.
5. **App Check**:
   - Android: Play Integrity. iOS: App Attest. Web: reCAPTCHA Enterprise (create a key).
   - Register debug tokens for dev builds.
   - Turn on **enforcement** for Firestore, Storage and Functions only after a dev build works.
6. Deploy: `npx firebase deploy --only firestore:rules,storage,functions,hosting --project dev`

## 3. EAS
```
npx eas-cli@latest init            # writes the projectId; also set EAS_PROJECT_ID
npx eas-cli env:create             # per environment (development / preview / production)
```

| Variable | Value |
|---|---|
| `GOOGLE_SERVICES_JSON` | file: google-services.json for that environment |
| `GOOGLE_SERVICES_PLIST` | file: GoogleService-Info.plist for that environment |
| `LINK_DOMAIN` | `nfc-app-prod.web.app`, or your domain |
| `GOOGLE_WEB_CLIENT_ID` | Firebase Auth → Google provider → Web client ID |
| `ADMOB_APP_ID_ANDROID` / `ADMOB_APP_ID_IOS` | AdMob app IDs |
| `ADMOB_NATIVE_ANDROID` / `ADMOB_NATIVE_IOS` | AdMob native unit IDs |
| `CONTACT_NOTES` | `1` once Apple grants the entitlement |
| `EAS_PROJECT_ID` | from `eas init` |

Dev client: `npx eas-cli build --profile development --platform android` (and ios), then `npm start`.

**iOS build note:** the app config uses React Native Firebase's default (SPM + `useFrameworks: "dynamic"`). If pods fail to link (ML Kit or AdMob static binaries), switch to RNFB's CocoaPods static mode:
1. Pass `{ "disableSPM": true }` to the `@react-native-firebase/app` plugin.
2. Set `useFrameworks: "static"`.
3. Add `forceStaticLinking: ["RNFBApp","RNFBAuth","RNFBFirestore","RNFBStorage","RNFBAppCheck","RNFBCrashlytics","RNFBAnalytics","RNFBFunctions"]` under `ios` in `expo-build-properties`.

## 4. Placeholders to replace

| File | Placeholder | Where to get it |
|---|---|---|
| `app.config.ts` | `APP_NAME`, `BUNDLE_ID`, `SCHEME` | Your decision. **Bundle ID is permanent after the first store upload.** Also update the bundle ID in `hosting/*` and `.maestro/*`. |
| `hosting/.well-known/apple-app-site-association` | `REPLACE_TEAM_ID` | Apple Developer → Membership → Team ID |
| `hosting/.well-known/assetlinks.json` | `REPLACE_WITH_EAS_SHA256_FINGERPRINT` | §2 step 4 (add both the upload and Play signing keys) |
| `hosting/p.html` | `RECAPTCHA_SITE_KEY`, `REPLACE_WITH_APP_STORE_ID` | App Check web key; App Store Connect app ID |
| `hosting/index.html` | `REPLACE_WITH_APP_STORE_ID` | App Store Connect |
| `hosting/app-ads.txt` | `pub-REPLACE_WITH_ADMOB_PUBLISHER_ID` | AdMob → Account |
| `hosting/privacy.html`, `terms.html` | `REPLACE_WITH_DATE`, Grievance Officer name and email | You plus a lawyer (§7) |

## 5. Custom domain
Firebase Hosting → Add custom domain. Then set `LINK_DOMAIN` in EAS env and rebuild, because the associated domains and intent filters are baked into the build.

## 6. Real-device checklist (before every release, spec §13)
- [ ] Devices: iPhone XS+, Samsung, Redmi, Pixel, OnePlus.
- [ ] Write an NFC tag, then tap it with an iPhone and with an Android → the card saves in the app.
- [ ] OCR in bright light, dim light and on glossy cards.
- [ ] NameDrop and Tap to Share contacts reach the inbox.
- [ ] Open links from the camera, WhatsApp and Instagram, with and without the app installed. The fallback page has "Open in app".
- [ ] Cold-start a deep link while signed in → the card saves, not just the home screen.
- [ ] Airplane mode: save 10 cards (QR, paper, link), reconnect, and confirm all of them sync, including photos.
- [ ] Budget phone (~₹10k): QR visible within 1.5 s from a cold start. Mid-range: about 1 s.
- [ ] Reminders fire, and tapping one opens the card. After a reinstall, the reminders come back.
- [ ] Ads: none in the first 7 days (change the device date to test). Never on Share, Scan, quick-save, Card detail, Me or the fallback page.
- [ ] **Deletion check:** create a test account, add cards with photos, delete the account, then confirm Firestore, Storage and Auth have no trace in the console.

## 7. Compliance before launch (spec §12)
- [ ] Legal review:
  - (1) keeping received snapshots after the owner deletes their account
  - (2) DPDP Rules phased timeline
  - (3) wording of the notice and consent
  - (4) privacy and terms drafts in `hosting/`
- [ ] App Store privacy label and Play Data safety form: contacts, location, photos, identifiers, usage data, crash data; ads are non-personalised.
- [ ] Breach-notification runbook: who notifies the Data Protection Board and users, and within what timeframe.

## 8. OCR quality
Add real, anonymised card texts to `src/lib/__fixtures__/cards.json` as you collect them. The CI gate (phones/emails ≥95%, names/companies ≥80%) then measures real-world accuracy.

## 9. Beta
TestFlight plus Play internal testing, then a closed beta with 20–50 users at a real expo. Track: activation (≥5 cards in week 1), W4 retention, `fallback_install_clicked / fallback_viewed`, and weekly `search_used`.
