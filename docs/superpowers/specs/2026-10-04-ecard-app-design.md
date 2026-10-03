# E-Visiting Card App — v1 Design Spec

- **Date:** 2026-10-04
- **Status:** Awaiting founder review
- **Repo:** https://github.com/KrishShah3011/NFC_App

## 1. Summary

This is a cross-platform (iOS + Android) app. Each user has one shareable profile, sent by QR code, NFC tag, or a link. The app also captures cards the user receives from anyone (app users, paper cards, contacts from NameDrop, Android Tap to Share or WhatsApp) and organizes them, so that a contact can be found later even after the user has forgotten the name.

The product is the **capture + recall** layer. Exchanging cards is how cards get into the app; it is not the differentiator.

## 2. Thesis validation

**Original thesis:** people share contacts or physical visiting cards but can't find them when they need them. An app that stores e-visiting cards makes them easy to find.

**Verdict:** the problem is real, but the framing needs to change. Storage is already solved by the phone's Contacts app. What fails is **recall**: "who was the packaging vendor I met at the Pune expo in March?" Contacts can't answer this, and searching by name fails when the name is the thing you forgot.

**Reframed thesis:** capture any card from anyone (paper, QR, NFC, link) in one tap, auto-tag where and when you met, and find it later even when you forget the name. Share your own card with anyone, with no app needed on their side.

**Flaws found in the original thesis, and how this design responds:**

| # | Flaw / bottleneck | Response in this design |
|---|---|---|
| 1 | Crowded market (Blinq 4M+ users, Popl, HiHello, V1CE). OS-native exchange is free: iOS NameDrop (iOS 17+) and Android Tap to Share (launched Aug 2026). | Don't compete on exchange. Compete on capture and recall. Treat NameDrop and Tap to Share as *intake sources* via the contacts inbox. |
| 2 | Network-effect trap: a receiver who has to install the app first means a failed first meeting. | A smart link plus a generic no-app fallback screen with "Save contact" (.vcf). The receiver never needs the app. |
| 3 | Another silo: users search the phone's Contacts, not a separate app. | Write-through to native Contacts (on by default). The app keeps the rich context. |
| 4 | iOS forbids third-party phone-to-phone NFC and NameDrop hooks. Host card emulation is EEA-only and needs an Apple entitlement. | QR codes and physical NFC tags are universal. NameDrop works only through the "My Card" setup plus the contacts inbox. |
| 5 | Most incoming cards are paper, from people who will never install the app. | On-device OCR scanning of paper cards and card photos, in v1. |
| 6 | Contact details go stale. | Live updates for cards that came from app users (pull model). |
| 7 | Consumers rarely pay. | v1 is free and ad-supported. Pro in v2, Teams in v3. |
| 8 | Storing other people's data is regulated (India DPDP Act, GDPR). | Address book never uploaded, consent at signup, deletion, export, legal review before launch. |

## 3. Goals, non-goals, constraints

**Goal:** launch a startup-grade v1 in India that proves people capture cards and later find them again.

**Constraints:**
- Works on both iOS and Android.
- A "seamless" experience: QR visible about 1 s after opening the app, scan to saved in under 2 s, no typing required to save.
- Built with AI assistance; the team is fluent in all mainstream stacks.
- Launch market is India first. Wider availability is possible, with EU/UK ad consent handled.

**v1 feature set (founder-approved):**
- A. Auto context on save (time + place)
- B. Events
- C. Notes + tags
- D. Fuzzy search + filters
- E. Paper card OCR scan (including "From photo")
- F. Contacts inbox (catches NameDrop, Tap to Share, WhatsApp and manual contacts)
- G. Follow-up reminders

**Non-goals for v1:**
- AI natural-language search (planned for v2 Pro)
- Payments and subscriptions of any kind (Pro in v2, Teams in v3)
- Deferred deep linking after install
- An Android phone acting as an NFC tag (host card emulation, planned for v1.1)
- Multiple profiles per user
- iOS App Clip
- Apple or Google Wallet passes
- Home-screen widgets
- Event auto-suggestion
- Scanning the back of a card
- UI languages other than English
- Changing a profile's link (slug rotation)

## 4. Monetization (v1)

v1 is free with in-app ads (AdMob). The guardrails below are part of the spec:

1. No ads on Share, Scan, the quick-save sheet, Card detail, Me, or the no-app fallback screen.
2. Native ads only: one in the Cards list after rows 5, 25, 45 and so on, and one in the Events list. No interstitials.
3. Non-personalized ads only (`requestNonPersonalizedAdsOnly: true`). This means no iOS App Tracking Transparency prompt, and contact data never goes to the ad network.
4. Google's User Messaging Platform (UMP) consent form appears only for users in the EEA and UK.
5. No ads during the user's first 7 days after signup.
6. "Ad-free" will become a Pro perk in v2.

## 5. Tech stack

| Layer | Choice |
|---|---|
| App | Expo (React Native) dev build, TypeScript, Expo Router |
| QR scan | `expo-camera` barcode scanning |
| NFC tag writing | `react-native-nfc-manager` (writing only; reading is handled by the OS through link dispatch) |
| OCR | Google ML Kit on-device text recognition (`@react-native-ml-kit/text-recognition`) |
| Phone number parsing | `libphonenumber-js`, defaulting to region IN |
| Contacts | `expo-contacts` |
| Location | `expo-location` (one foreground location fix plus platform reverse geocoding) |
| Reminders | `expo-notifications` (local scheduled notifications) |
| Ads | `react-native-google-mobile-ads` (includes UMP) |
| Home-icon shortcuts | `expo-quick-actions` |
| Search | Fuse.js over the cards stored on the device |
| Backend SDK | `@react-native-firebase/*`: auth, firestore, storage, app-check, crashlytics, analytics |
| Backend | Firebase: Auth, Firestore (region `asia-south1`, Mumbai), Storage, Hosting, one Cloud Function |
| Build / OTA | EAS Build, EAS Update (channels `preview` and `production`) |
| CI | GitHub Actions |
| Tests | Jest, Firebase Emulator with `@firebase/rules-unit-testing`, Maestro |

**Why this stack:**
- Firestore's native SDK provides offline-first sync, so no custom sync engine is needed.
- TypeScript is used across the app and the fallback page.
- EAS Update ships fixes without app-store review.
- AdMob and Firebase share one ecosystem.

**Alternatives rejected:**
- Flutter + Firebase: viable, but needs a second language for the fallback page and a paid add-on (Shorebird) for over-the-air updates.
- Expo + Supabase + PowerSync: adds a separately hosted sync service for the same v1 scope. Reconsider for Teams/analytics in v3.

## 6. Architecture

```
Mobile app (Expo dev build)
  Screens: Share · Scan · Cards (incl. Inbox, Events) · Card detail · Me
  Device: camera/QR · NFC write · ML Kit OCR · contacts · location · local notifications · ads
  Data: @react-native-firebase (Firestore offline cache, unlimited size)
  Search: Fuse.js over local cards
        │
Firebase (asia-south1)
  Auth: phone OTP, Google, Apple
  Firestore: public profiles · private per-user cards/events
  Storage: public profile photos · private card images
  Hosting: <domain>/p/{slug} fallback page, AASA + assetlinks, app-ads.txt, privacy policy, terms
  Functions: deleteAccount (wipes all of a user's data)
  App Check: Play Integrity / App Attest / reCAPTCHA Enterprise (web)
```

### 6.1 Smart link

- Every QR code and NFC tag encodes `https://<domain>/p/{slug}`. The slug is 10 random base62 characters, roughly 8×10¹⁷ possibilities.
- **App installed:** iOS Universal Links and Android App Links open the app directly, and the app saves the card.
- **App not installed:** Firebase Hosting serves one generic fallback page, the same for every user and rendered from the profile document. It shows the profile, a **Save contact** button (generates a `.vcf` on the client), a **Get the app** button (detects iOS or Android and links to the right store) and an **Open in app** button (custom URL scheme). The last button exists because in-app browsers such as WhatsApp's and Instagram's don't trigger Universal Links.

### 6.2 Data model (Firestore)

```
profiles/{slug}                    public: get allowed, list denied
  ownerUid, name, title, company, phones[], emails[], website,
  address, socials{linkedin, x, instagram, whatsapp}, photoUrl, updatedAt

users/{uid}                        private
  profileSlug, createdAt

users/{uid}/cards/{cardId}         private
  source: "app" | "paper" | "contacts" | "manual"
  profileSlug?                     set when source = "app"; enables live updates
  pending?                         true if scanned offline and not yet resolved
  name, title, company, phones[], emails[], website, address, photoUrl   (snapshot)
  cardImagePath?                   Storage path, or local file path while upload is pending
  metAt, place{lat, lng, label?}, eventId?
  notes, tags[]
  followUp?{dueAt, note, done}
  createdAt, updatedAt

users/{uid}/events/{eventId}
  name, startsAt, endsAt, placeLabel?
```

**Deliberate simplifications:**
- The profile's document ID *is* the slug. This makes fetching a profile from its link a direct lookup and keeps "list denied" trivial. The ceiling is that a link can't be rotated. Add slug rotation if leaked tags become a real problem.
- Tags are an array on each card, and the tag list is derived from the cards. There is no tags collection.
- There is one follow-up per card, embedded in the card. Add a reminders subcollection if users ask for multiple reminders.

**Device-local only (never synced):**
- The mapping from card to phone contact ID.
- The snapshot of contact IDs used by the inbox.
- The list of dismissed inbox items.
- The list of contact IDs created by the app.

These are never synced because contact IDs differ on every device.

**Live updates use a pull model.** The app refreshes a card that came from an app user when the card is opened, plus a full refresh on the first app open at least 7 days after the previous full refresh. Pushing updates to everyone who saved a profile was rejected, because it would need a "who saved whom" index, which is a privacy cost and extra code.

## 7. Core flows

1. **Onboarding**
   - Sign in by phone OTP (the default), Google or Apple.
   - Create the profile. The fastest path is to scan your own paper card through the OCR pipeline, then edit the result.
   - Ask for each permission just in time, never all upfront.
   - An optional step guides the user to set the profile as their iOS "My Card" (Settings › Contacts › My Info) or the Android Tap to Share card. Apps can't set these programmatically.
2. **Share (the screen the app opens on)**
   - Full-screen QR code with brightness boosted, rendered from locally cached profile data so it works offline.
   - **Write NFC tag:** writes an NDEF URI record and leaves the tag unlocked.
   - **Send link:** opens the system share sheet (WhatsApp, SMS and so on).
3. **Receive from an app user**
   - The link arrives by in-app scan, the system camera, or an NFC tap. The OS dispatches the URL to the app, which parses the slug.
   - **Duplicate profile:** open the existing card with an "Already saved" toast.
   - **Otherwise:** fetch the profile, then save the card with `metAt = now`, `place` (one location fix with a 5 s timeout, reverse geocoded) and `eventId` (the active event). Open the quick-save sheet and write through to native Contacts if the setting is on.
   - **Offline:** save the card with `profileSlug` and `pending: true`, and resolve it on reconnect.
4. **Paper card scan / From photo**
   - Capture a photo or pick one from the gallery, then run ML Kit OCR and the field parser:
     - Phones: `libphonenumber-js`, default region IN.
     - Email and URL: regex.
     - Name, title and company: heuristics.
   - A review form opens with the fields prefilled and the card image shown. Save adds the same auto context as in flow 3.
   - A **Scan next** button supports batch capture.
5. **Contacts inbox**
   - On every app foreground, with full contacts permission, diff the current contact IDs against the local snapshot.
   - New IDs go to the inbox, except IDs already linked to a card, created by the app, or previously dismissed.
   - **First run:** take a baseline snapshot only; nothing goes to the inbox.
   - Each item offers **Add context** (suggests events active between the last app open and now; place left empty) or **Dismiss**.
   - Accepted items become cards with `source = "contacts"`.
   - With iOS 18+ limited contacts access, the inbox is disabled and the app explains why.
6. **Events**
   - **Start event:** name plus an end time, defaulting to local midnight.
   - While an event is active, a banner shows on Share and Scan, and every capture gets that `eventId`.
   - Cards can be added to an event retroactively by multi-select from that day.
7. **Search**
   - Fuse.js fuzzy search over name, company, title, notes, tags, event name and place label.
   - Filter chips for event, tag, date range (this week, this month, custom) and source.
   - Results sorted most recent first.
8. **Follow-ups**
   - **Remind me** offers presets (tomorrow, 3 days, 1 week, custom) and schedules a local notification. Tapping the notification deep-links to the card.
   - On every app start, cancel all scheduled reminders and reschedule every future, not-done follow-up. This is idempotent and survives reinstalls and new devices.
9. **Live updates**
   - When a profile's `updatedAt` is newer than the card's snapshot, update the snapshot and show "Updated X ago".
   - The linked phone contact is **not** changed automatically. The **Update phone contact** button copies the new details across.
10. **Write-through to native Contacts**
    - The contact gets the card's fields plus a deep link back to the card.
    - The context line ("Met at <event>, <place>, <date>") goes in the Notes field on Android always, and on iOS only if Apple grants the `com.apple.developer.contacts.notes` entitlement.
11. **Account deletion**
    - Done in-app, as Apple requires.
    - The `deleteAccount` Cloud Function removes the profile, the user document, all cards and events, all Storage files, and the Auth user.
12. **Export**
    - Free "Export all cards as .vcf" through the system share sheet.

## 8. Screens & UX

- **Tabs:** Share · Scan · Cards · Me.
- **Share:**
  - QR code, name and active-event banner.
  - Write NFC tag and Send link buttons.
- **Scan:**
  - Camera that auto-detects QR codes: our link, vCard/MeCard (saved as a card) and LinkedIn (saved as a card). Anything else shows "Not a contact QR".
  - Paper card capture button.
  - From photo button.
- **Quick-save sheet:**
  - Auto-filled context chips, a note field, a tag picker and Done.
  - Swiping it away still keeps the card.
- **Cards:**
  - Search bar, filter chips, inbox banner, follow-ups-due banner.
  - Rows show photo or initials, name and company, then event or place with the date.
  - A Cards | Events segment. Events shows the active event first, a Start event button, and event detail with the event's cards.
- **Card detail:**
  - Header.
  - Call · WhatsApp (`wa.me`) · Email · Save or Update phone contact.
  - Editable context, notes, tags, follow-up.
  - Card image, "Updated X ago" badge, delete.
- **Me:**
  - Edit profile and preview.
  - NameDrop / Tap to Share guide.
  - Settings: save to Contacts by default, location on/off.
  - Sign out, delete account, export, privacy policy.
- **Home-icon quick actions:** "Show my QR", "Scan card".
- **Performance targets:**
  - QR visible about 1 s after opening on a mid-range phone, and within 1.5 s from a cold start on a budget phone (around ₹10k).
  - Scan to saved in under 2 s.
- **Baseline:** light and dark mode, dynamic type, screen-reader labels, sufficient contrast. Visual design is decided at implementation time.

## 9. Offline behaviour

- Firestore persistence is on, with cache size set to unlimited (`CACHE_SIZE_UNLIMITED`). All cards stay on the device, and local search depends on that.
- **Image upload queue:**
  - Images are saved to the app's document directory first, and the card stores the local path.
  - Uploads retry when the app comes to the foreground or connectivity returns (NetInfo), and the card switches to the Storage path once the upload succeeds.
  - Until then, the image is shown from the local file.
- App-user cards scanned offline are saved `pending` and resolved on reconnect.
- Place coordinates recorded offline are stored, and the place label is reverse-geocoded later.
- Sign-in needs the network once; after that, the cached session works offline.

## 10. Error handling

| Case | Behaviour |
|---|---|
| Unknown QR code | "Not a contact QR". Nothing is saved |
| Slug not found or profile deleted | Keep the last snapshot, show "No longer shared", stop live updates |
| OCR finds no text | Review form opens blank with the image; the image is never discarded |
| NFC write fails (locked, too small, not NDEF) | Specific message. The URL is about 40 bytes, so NTAG213 (144 bytes) is enough |
| Permission denied | Only that feature is disabled, with an explanation and a link to Settings |
| Universal link swallowed by an in-app browser | The fallback page's "Open in app" button (custom scheme) |
| Crash | Firebase Crashlytics |

**Analytics** (Firebase Analytics, ad ID collection disabled):
- `card_saved{source}`
- `qr_shown`
- `nfc_written`
- `inbox_accepted`
- `search_used`
- `fallback_viewed`
- `fallback_install_clicked`

## 11. Security

- **Firestore rules:**
  - `profiles/{slug}`: `get` allowed to anyone, `list` denied. Create and update only when `request.auth.uid == ownerUid`, with field and size validation.
  - `users/{uid}/**`: read and write only when `request.auth.uid == uid`.
- **Storage rules:**
  - `profiles/{slug}.jpg`: public read; owner write; image content types only; under 2 MB.
  - `users/{uid}/**`: owner only.
- **App Check** is enforced on Firestore, Storage and Functions: Play Integrity on Android, App Attest on iOS, reCAPTCHA Enterprise on the fallback page.
- **Phone auth SMS region policy:** allow India plus an explicit short list of countries, to prevent SMS pumping fraud.
- **No secrets in the app bundle.** The only server code is `deleteAccount`.

## 12. Privacy & compliance (DPDP Act / GDPR / store policies)

- **The address book is never uploaded.** The inbox snapshot stays on the device, and only contacts the user accepts are synced.
- **Location:** only while the app is in use, one fix per capture.
- **Signup:** an itemized notice, explicit consent, and an 18+ confirmation.
- **Required rights and processes:**
  - In-app deletion.
  - Free .vcf export.
  - A published grievance contact.
  - A breach-notification runbook.
- **Store disclosures:** Apple privacy label and Google Play Data safety form covering contacts, location, photos, identifiers and app usage.
- **Legal review before launch:**
  1. Retaining a received snapshot after the profile owner deletes their account. The proposed answer is to keep it, like a paper card.
  2. The DPDP Rules' phased compliance timeline.
  3. The wording of the notice and consent.

## 13. Testing

- **Jest unit tests:**
  - **OCR field parser,** against about 30 anonymized real Indian card fixtures. **v1 accuracy gate:** phone and email at least 95%, name and company at least 80%, run on every change.
  - QR payload parser: our link, vCard, MeCard, LinkedIn, rejection of anything else.
  - vCard generation.
  - Inbox diff: baseline on first run, ignores app-created contacts, dismissed items stay dismissed.
  - Search and filters.
  - Follow-up rescheduling is idempotent.
  - Ad rules: 7-day grace period and placement positions.
- **Security rules tests** against the Firebase Emulator:
  - Listing profiles is denied.
  - Cross-user access is denied.
  - Only the owner can write their profile.
  - These run in CI and are required to pass before merging.
- **Maestro E2E** on an Android emulator and an iOS simulator: onboarding, save a card (scans injected as deep links), search, events, follow-ups, account deletion.
- **Real-device checklist for each release:**
  - Devices: iPhone XS or newer, Samsung, Redmi, Pixel, OnePlus.
  - NFC write, then tap to read on iOS and on Android.
  - OCR in bright light, dim light and on glossy cards.
  - NameDrop and Tap to Share contacts reach the inbox.
  - Links opened from the camera, WhatsApp and Instagram, with and without the app installed.
  - Airplane-mode expo test: save 10 cards, reconnect, confirm all sync.
  - Budget phone: QR visible within 1.5 s from a cold start.

## 14. Release & operations

- **Firebase projects:** `dev` and `prod`.
- **GitHub Actions on every PR:** lint, `tsc`, Jest, rules tests.
- **EAS:** EAS Build for store binaries. EAS Update channels `preview` and `production`.
- **Beta:** TestFlight and Play internal testing, then a closed beta with 20–50 users at a real expo.
- **Long-lead items (start immediately):**
  - Apple Developer Program as an organization ($99/yr; needs a D-U-N-S number).
  - Google Play organization account ($25). This avoids the closed-testing requirement that applies to new personal accounts.
  - Request the iOS contacts-notes entitlement.
  - Register the domain and host AASA, `assetlinks.json`, `app-ads.txt`, the privacy policy and the terms.
  - AdMob account.
  - DPDP legal review.

## 15. Success metrics (beta)

- **Activation:** at least 40% of new users save 5 or more cards in week 1.
- **Retention:** at least 25% are active in week 4.
- **Viral:** at least 10% of fallback-page viewers click to install.
- **Recall (the core thesis):** at least 30% of weekly active users search or filter each week.

## 16. Build order

1. **Setup:** accounts, Firebase dev/prod, Expo dev build, CI.
2. **Profile and sharing:** QR code, NFC write, Send link, fallback page, Universal Links and App Links.
3. **Receive and cards:** app-user capture, auto context, quick-save sheet, card detail, write-through to Contacts.
4. **Paper card OCR and From photo.**
5. **Events, search, follow-ups.**
6. **Contacts inbox and live updates.**
7. **Ads, analytics, privacy and compliance, account deletion, export.**
8. **Beta, then store launch.**

## 17. Risks

| Risk | Mitigation |
|---|---|
| OCR field-parsing accuracy on varied Indian card layouts | Review screen on every scan, a fixture-based accuracy gate in CI, an upgrade path to LLM parsing in Pro |
| Apple denies the contacts-notes entitlement | A deep link in the contact's URL field carries the context into the app |
| Users grant iOS limited contacts access | The inbox is disabled with an explanation; every other feature still works |
| Universal Links unreliable in in-app browsers | "Open in app" button on the fallback page |
| Firestore read costs at scale | Weekly (not continuous) live-update refresh; local search means no server queries |
| Low ad revenue / ads hurting trust | Strict guardrails (section 4); Pro removes ads in v2 |
| SMS OTP fraud costs | SMS region allowlist plus App Check |

## 18. Founder inputs still required

These items don't block the design, but they are needed before the first store build:
- **App name.** Used for the bundle ID, store listings and the URL scheme. Placeholder in this spec: `<app>`.
- **Domain.** Used for smart links and hosting. Placeholder in this spec: `<domain>`.
