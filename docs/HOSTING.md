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
- Auth: Google sign-in only, via Firebase Authentication. Firebase
  Authentication requires the serving domain to be in the project's
  authorized domains list — `paul-barelyartificial.github.io` is a domain
  grant (path-independent), so the repo rename did not require any Firebase
  config change.
- Firestore data model: `users/{userId}/tasks/{taskId}`, access restricted
  to the signed-in user's own collection via Firestore security rules.
- The `apiKey` and other values in `firebase/config.js` are the public
  client config Firebase expects to ship to the browser — not secrets.
  Security comes from Auth + Firestore rules, not from hiding this file.

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
2. Bump `VERSION.txt` and add a `docs/ROADMAP.md` Shipped entry.
3. Commit changes (see commit discipline in `AGENTS.md`).
4. Push to `main` — GitHub Pages deploys automatically.
5. Wait for the Pages build to complete (`gh api
   repos/Paul-BarelyArtificial/BAA-001-BarelyThingsToDo/pages` shows
   `"status":"built"` once done).
6. Hard-refresh the live app.
7. Confirm the footer version matches the release.
