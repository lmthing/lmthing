# Publishing the mobile app to Google Play — runbook

Written 2026-07-29. What `org/docs/mobile/README.md` explains, this file *sequences*: the
order to do things in the Play Console, the answers to the forms, and the copy to paste.
Reference lives in `org/docs`; this is the checklist.

The account is an **organization** account, so the 12-testers-for-14-days closed testing
requirement does **not** apply — that one is only for personal accounts created after
13 Nov 2023. You can go to production once review passes. Do an internal test first
anyway; it costs an hour and catches the install-time faults no emulator shows.

---

## 0. Before the Console

```bash
cd sdk/org/apps/mobile
npm i -g eas-cli          # or npx eas-cli@latest for every command below
eas login                 # interactive — run it yourself with `! eas login`
```

The EAS project id is already in `app.config.js` (`deb721b3-…`), so `eas init` has
nothing to reconcile. If your Expo account is an **organization**, add its slug as
`owner` in `app.config.js` — without it EAS builds under your personal account.

**Commit first.** EAS uploads the git tree, and `sdk/org` is a submodule with its own
root; uncommitted changes are not in the build.

---

## 1. Build

```bash
eas build --platform android --profile preview      # APK — sideload and try it
eas build --platform android --profile production   # AAB — the store artifact
```

The first production build prompts to generate an upload keystore. **Let EAS generate
and hold it.** Play App Signing holds the real signing key; the upload key is only how
you authenticate a new bundle. `eas credentials` shows it later.

### Building on this machine instead of the queue

The free tier queues. `--local` runs the same profile here — same `eas.json`, same
`eas-build-post-install`, same credentials — and needs only the toolchain that is
already installed (Java 17, `ANDROID_HOME=~/Android/Sdk`):

```bash
eas build --platform android --profile production --local
```

It still signs with the keystore EAS holds, which is the point. **Do not reach for
`./gradlew :app:bundleRelease` instead:** Expo's generated `build.gradle` sets
`release { signingConfig signingConfigs.debug }`, so it emits a debug-signed bundle
that Play refuses with *"You uploaded an APK or Android App Bundle that was signed in
debug mode"*. Fixing that file does not stick either — `android/` is gitignored and
`expo prebuild` regenerates it.

To build with no EAS account at all, own the keystore locally:

```bash
keytool -genkey -v -keystore release.keystore -alias upload \
  -keyalg RSA -keysize 2048 -validity 10000
```

then add `"credentialsSource": "local"` to the production profile in `eas.json` and a
`credentials.json` beside it naming that keystore. **Back the file up somewhere you
cannot lose it** — with Play App Signing a lost upload key is recoverable by asking
Google to reset it, but it is a support round-trip you do not want mid-release. Add
both `release.keystore` and `credentials.json` to `.gitignore`.

`versionCode` comes from EAS (`appVersionSource: "remote"` + `autoIncrement`), so you
never edit it. Bump the human-facing `version` in `app.config.js` when it means
something.

---

## 2. Create the app in Play Console

**All apps → Create app.**

| Field | Value |
|---|---|
| App name | `LMThing` (max 30 chars) |
| Default language | English (United States) |
| App or game | App |
| Free or paid | Free — in-app purchases are billed through Stripe on the web, not Play |

Package name `org.lmthing.mobile` is fixed at first upload and **can never be changed**.

> Free vs paid matters: the app unlocks paid tiers bought on lmthing.com. Google requires
> Play Billing for digital content **consumed in the app**. Selling the subscription on
> your own website and having the app recognise it is the standard arrangement, but do
> not add a link or button inside the app that sends someone to buy — that is what gets
> flagged. Worth a look at the current Payments policy before you submit.

---

## 3. The forms, in the order the Console nags you

### App access — **this is the one that gets apps rejected**

Every screen past launch is behind a login, and sign-in is GitHub SSO with no password
path. Choose **"All or some functionality is restricted"** and provide:

- A GitHub account the reviewer can actually sign into — **no 2FA**, or they cannot get
  past GitHub's own prompt and will reject for "could not access the app".
- Instructions: *"Tap Sign in, authorise with the GitHub credentials above. The first
  launch provisions a workspace and takes up to 30 seconds."*

Test that account end to end on a real device before submitting.

### Data safety

| Question | Answer |
|---|---|
| Does your app collect or share user data? | Yes |
| Is all data encrypted in transit? | Yes |
| Do you provide a way to delete data? | Yes → `https://lmthing.com/delete-account` |

Data types to declare — all **collected**, none **shared for advertising**:

| Type | Collected | Purpose | Optional? |
|---|---|---|---|
| Name / email | Yes | Account management | Required |
| User IDs | Yes | Account management | Required |
| Messages (in-app content) | Yes | App functionality | Required |
| Files & docs | Yes | App functionality | Optional |
| Purchase history | Yes | App functionality (billing) | Optional |
| Device IDs (push token) | Yes | App functionality (notifications) | Optional |

Declare **no** advertising or analytics data — the app ships neither SDK.

"Shared" means transferred to a third party. Conversation content does go to model
providers as processors. Google's definition excludes service providers acting on your
instructions, so this is normally *collected, not shared* — but say so in the privacy
policy either way, which `/privacy` does.

### Content rating

Questionnaire, category **Utility / Productivity**. Answer no to violence, sexual
content, gambling and controlled substances. The one to think about: the app shows
**user-generated content** (your own conversations) and an AI can produce arbitrary
text — declare UGC and that there is a moderation/reporting path.

### Target audience

18+. Do not tick anything under 13 — that pulls in Families policy and a much stricter
review.

### Privacy policy

`https://lmthing.com/privacy` — paste into Store settings **and** Data safety.

### Ads

"No, my app does not contain ads."

---

## 4. Store listing

**Short description** (80 max):

```
Your personal THING — a private AI companion that knows your context.
```

**Full description** (4000 max):

```
LMThing is a private AI companion that knows your context.

Chat naturally with THING, your own agent. It remembers what you are working on,
switches between models on the fly, and keeps every conversation synced across your
phone and the web.

WHAT YOU CAN DO

• Chat — a conversation that carries context between sessions, not a blank box every
  time.
• Build — describe what you want and watch THING build a working app: a database,
  pages, an API. It runs in your own workspace.
• Teams — private channels where THING works alongside your colleagues, with threads
  and shared projects.
• Your own runtime — every account gets a real cloud workspace with files and compute,
  started on demand and asleep when you are not using it.

PRIVATE BY DEFAULT

Your workspace belongs to you. No advertising, no analytics SDKs, no selling data.
Conversations go to the AI model serving them and nowhere else. You can delete your
account and everything in it at any time.

Requires a free account. Paid plans are available at lmthing.com.
```

**Graphics** — generated, in `sdk/org/apps/mobile/store/`:

| Asset | File | Spec |
|---|---|---|
| App icon | `store/icon-512.png` | 512×512, 32-bit PNG, no alpha ✓ |
| Feature graphic | `store/feature-graphic.png` | 1024×500 ✓ |
| Phone screenshots | **still needed** | 2–8, min 320px, 16:9 or 9:16 |

Screenshots are the gap. Take them on the emulator at phone size, signed in, showing:
Home, a real conversation with THING, a team channel, and an app THING built. Do not
ship the empty states — a screenshot of an empty list sells nothing.

```bash
adb exec-out screencap -p > shot-01.png
```

---

## 5. Release, in this order

1. **Internal testing** — add your own address, upload the AAB, install from the opt-in
   link on a real phone. This is where signing, the icon on a real launcher, push, and
   cold-start actually get proven.
2. **Closed testing** — optional for an organization account. Worth one round if you
   want feedback before strangers see it.
3. **Production** — submit for review. First review is usually a few days and is slower
   than later ones.

```bash
eas submit --platform android --latest
```

`eas.json` aims submission at the internal track as a **draft**, so nothing goes live by
accident. Promote in the Console when you are ready.

For `eas submit` you need a Google service account JSON: Play Console → Setup → API
access → create a service account in Google Cloud, grant it *Release manager*, download
the key to `sdk/org/apps/mobile/play-service-account.json` (gitignored). Or skip it and
upload the AAB by hand for the first release.

---

## Open risks

- **Interactive SSO has never completed on a device.** The code path exists and is
  correct-looking; the one device run seeded a session instead of signing in. If it is
  broken, the reviewer hits it before you do. Verify before submitting.
- **No self-service account deletion.** `/delete-account` is a request path, not a
  button. Google accepts that, but the requests have to actually be honoured — and
  `support@lmthing.org` must be a mailbox someone reads.
- **`lint:tokens` is red on `main`** — three `rgba()` literals in
  `sdk/org/libs/ui/src/elements/primitives/_native.tsx`. Unrelated to the app, but it is
  a hard CI gate and will block a release commit if CI is enforced.
