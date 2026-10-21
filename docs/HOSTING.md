# Hosting

## Stack
- Plain static site: HTML5, CSS3, JavaScript ES modules. No build step, no
  `package.json`, no bundler.
- Hosting: **GitHub Pages**, built from the `main` branch, root folder
  (GitHub Pages legacy build, no Actions workflow).
- Backend: **Firebase** — Authentication (Google sign-in) + Firestore
  (cloud task storage), called directly from the browser via the Firebase
  JS SDK (loaded from `gstatic.com`, see `firebase/config.js`).
- Offline (v1.8.0 on): Firestore's own persistent (IndexedDB-backed) local
  cache is enabled in `firebase/firestore.js` via `initializeFirestore()` +
  `persistentLocalCache()` — reads work from cache offline, writes queue
  locally and sync automatically when back online, no custom queue needed.
  `sw.js` separately caches the static app shell (HTML/CSS/JS/images) via
  the Cache API so the page itself can load with no network at all —
  cache-first for `?v=`-versioned assets, network-first-with-cache-fallback
  for everything else. Single-tab persistence only
  (`persistentSingleTabManager()`) — opening the app in two tabs at once
  isn't a supported case.

## Live URL
**https://todo.barelyartificial.app**

Custom domain (2026-10-21), matching the rest of the portfolio's
`xxxxx.barelyartificial.app` convention. Backed by a `CNAME` file at the
repo root — GitHub Pages serves the site on this domain as long as that
file exists and isn't overwritten or removed (e.g. by a force-push).
DNS: a `CNAME` record for `todo` → `paul-barelyartificial.github.io` in
the `barelyartificial.app` zone (Cloudflare, proxy **off** — GitHub Pages
needs to see the real DNS record directly to issue its HTTPS certificate;
proxying through Cloudflare breaks that).

Old URL (now dead): `https://paul-barelyartificial.github.io/BAA-001-BarelyThingsToDo/`
— GitHub Pages redirects it to the custom domain above once a `CNAME` file
is present, same no-redirect caveat applies if the repo is ever renamed
again. Before that, the URL was
`https://paul-barelyartificial.github.io/to-do-tomorrow/`, dead since the
2026-10-20 repo rename.

If the domain or repo ever changes again: update any installed PWA
(phone/desktop — delete and reinstall from the new URL), browser
bookmarks, and any link from `barelyartificial.com` or elsewhere.

## Firebase project
- Project ID: `to-do-tomorrow-b01e3` (unchanged by the GitHub repo rename —
  Firebase project IDs are independent of the GitHub repo name).
- Auth: Google sign-in, or email/password sign-in for `@barelyartificial.com`
  addresses (Email/Password provider enabled manually in the Firebase
  console — see `firebase/auth.js`). Firebase Authentication requires the
  serving domain to be in the project's authorized domains list —
  `todo.barelyartificial.app` was added manually in the Firebase console
  (Authentication → Settings → Authorized domains) for the 2026-10-21
  custom domain move; `paul-barelyartificial.github.io` is left in the
  list rather than removed, in case the custom domain ever needs rolling
  back.
- Firestore data model: `users/{userId}/tasks/{taskId}` for personal lists,
  plus `companies/barely-artificial/tasks/{taskId}` for the shared Company
  List, plus (v1.11.0 on) a `users/{userId}` profile doc holding
  `dailyNotificationsEnabled`. Access restricted per-collection via
  `firestore.rules`, deployed with `firebase deploy --only firestore:rules`.
- The `apiKey` and other values in `firebase/config.js` are the public
  client config Firebase expects to ship to the browser — not secrets.
  Security comes from Auth + Firestore rules, not from hiding this file.
- Billing: upgraded to the **Blaze** (pay-as-you-go) plan on 2026-10-21,
  needed for Cloud Functions (see below) — previously on the free Spark
  plan.

## Cloud Functions (daily notification email)
Added in v1.11.0 — the app's first real backend component. Source lives in
`functions/` (its own `package.json`/`node_modules`, not part of the
static site's dependency-free front end). A single scheduled function,
`sendDailyNotifications` (`functions/index.js`), runs on a Cloud Scheduler
trigger: queries `users/{uid}` docs with `dailyNotificationsEnabled ==
true`, builds each user's task list (personal + anything assigned to them
on the Company List, for `@barelyartificial.com` accounts) and emails it
via the [Resend](https://resend.com) API — called directly from the
function rather than Firebase's "Trigger Email" extension, to avoid an
extra piece of extension config.
- **Secret:** `RESEND_API_KEY`, set via Secret Manager — never stored in
  the repo or in `functions/.env`. Set/rotate it with:
  ```
  firebase functions:secrets:set RESEND_API_KEY --project to-do-tomorrow-b01e3
  ```
  (prompts interactively; the value never needs to touch a file or chat).
- **Sending domain:** `barelyartificial.app`, already verified in Resend.
  `FROM_EMAIL` defaults to `todo@barelyartificial.app` in
  `functions/index.js` — override by creating a gitignored
  `functions/.env` with `FROM_EMAIL=...` before deploying, if that ever
  needs to change.
- **Schedule:** `0 8 * * *`, `Europe/London` — set in the `onSchedule(...)`
  config in `functions/index.js`. Confirm/adjust with Paul before relying
  on it; it's currently a placeholder default.
- **`.firebaserc`** pins the default project to `to-do-tomorrow-b01e3`, so
  `firebase` CLI commands don't need `--project` once run from the repo
  root.
- Deploy with `firebase deploy --only functions --project to-do-tomorrow-b01e3`
  (or `npm run deploy` from inside `functions/`) — needs the Blaze plan
  and the `RESEND_API_KEY` secret set first, or the deploy/invocation
  fails.
- No app-code cache-busting involved — this doesn't touch the static site
  the browser loads, so it's deployed independently of the usual GitHub
  Pages release process above.

## Cache-busting (read this before every deploy)
Every `?v=...` query string across the app has to move together, not just
`index.html`'s `<script>`/`<link>` tags. `js/app.js` imports
`firebase/auth.js` and `firebase/firestore.js` as ES modules, and those
import `firebase/config.js` — all **relative imports, with no query
string of their own**. A browser caches each file by its exact URL
(including the query string), so if only `index.html`'s reference to
`js/app.js?v=X` gets bumped, a returning visitor can still get a *stale
cached* `firebase/firestore.js` underneath it. If that stale file is
missing an export the new `app.js` expects (exactly what happened going
from v1.2.0 to v1.3.0 — `firestore.js` gained `updateTask`), the whole
module fails to load and **every button on the page silently does
nothing** — no error visible to the user, nothing in the UI to explain it.

So: every release, bump the version query string in **all** of these,
together, not just the two in `index.html`:
- `index.html` — `css/styles.css?v=X`, `js/app.js?v=X`
- `js/app.js` — the `../firebase/auth.js?v=X` and
  `../firebase/firestore.js?v=X` import specifiers
- `firebase/auth.js` and `firebase/firestore.js` — the `./config.js?v=X`
  import specifier in each

This is checked in the verification workflow (step 1) before every deploy,
but is cheap enough to `grep -rn "v=1\."` the whole repo and confirm every
match agrees.

**`sw.js`'s `CACHE_NAME` is the same category of thing (v1.8.0 on).** The
service worker caches the static app shell for offline use; it keeps
serving whatever it cached under the old `CACHE_NAME` until that constant
changes, since `self.addEventListener("activate", ...)` only deletes
caches that don't match the *current* `CACHE_NAME` — meaning a release
that forgets to bump it leaves offline users on the old app shell
indefinitely, even though online users get the new one immediately. Bump
it alongside everything else above.

## Local dev
- Open `index.html` directly in a browser for simple UI-only testing (no
  auth/sync).
- For Firebase Authentication and Firestore testing, either use the live
  Pages URL above, or serve the folder through a local web server — Firebase
  Authentication requires an authorized domain, so `file://` won't support
  sign-in.

## Deploy process
1. Test locally where possible (desktop browser, mobile browser, installed
   PWA).
2. Bump `VERSION.txt`, **every** cache-busting `?v=` query string (see
   above — not just `index.html`'s), and add a `docs/ROADMAP.md` Shipped
   entry.
3. Commit changes (see commit discipline in `AGENTS.md`).
4. Push to `main` — GitHub Pages deploys automatically.
5. Wait for the Pages build to complete (`gh api
   repos/Paul-BarelyArtificial/BAA-001-BarelyThingsToDo/pages` shows
   `"status":"built"` once done).
6. Hard-refresh the live app.
7. Confirm the footer version matches the release.
