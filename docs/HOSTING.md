# Hosting

## Stack
- Plain static site: HTML5, CSS3, JavaScript ES modules. No build step, no
  `package.json`, no bundler.
- Hosting: **GitHub Pages**, built from the `main` branch, root folder
  (GitHub Pages legacy build, no Actions workflow).
- Backend: **Firebase** — Authentication (Google sign-in) + Firestore
  (cloud task storage), called directly from the browser via the Firebase
  JS SDK (loaded from `gstatic.com`, see `firebase/config.js`).

## Live URL
**https://paul-barelyartificial.github.io/BAA-001-BarelyThingsToDo/**

This URL is tied to the repo name — if the repo is ever renamed again, the
Pages URL changes with it and the old one 404s immediately (no redirect,
unlike the `github.com` repo page and git URLs, which GitHub does redirect).
Previous URL (now dead): `https://paul-barelyartificial.github.io/to-do-tomorrow/`
— dead as of the 2026-10-20 rename to `BAA-001-BarelyThingsToDo`.

If this ever happens again: update any installed PWA (phone/desktop — delete
and reinstall from the new URL), browser bookmarks, and any link from
`barelyartificial.com` or elsewhere.

## Firebase project
- Project ID: `to-do-tomorrow-b01e3` (unchanged by the GitHub repo rename —
  Firebase project IDs are independent of the GitHub repo name).
- Auth: Google sign-in, or email/password sign-in for `@barelyartificial.com`
  addresses (Email/Password provider enabled manually in the Firebase
  console — see `firebase/auth.js`). Firebase Authentication requires the
  serving domain to be in the project's authorized domains list —
  `paul-barelyartificial.github.io` is a domain grant (path-independent),
  so the repo rename did not require any Firebase config change.
- Firestore data model: `users/{userId}/tasks/{taskId}` for personal lists,
  plus `companies/barely-artificial/tasks/{taskId}` for the shared Company
  List. Access restricted per-collection via `firestore.rules`, deployed
  with `firebase deploy --only firestore:rules`.
- The `apiKey` and other values in `firebase/config.js` are the public
  client config Firebase expects to ship to the browser — not secrets.
  Security comes from Auth + Firestore rules, not from hiding this file.

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
