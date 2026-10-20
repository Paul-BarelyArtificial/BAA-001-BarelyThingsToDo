# Roadmap

Source of truth for what's shipped, planned, and deliberately not built.
Pre-standard history (through v1.0.0) lives in `CHANGELOG.md` and
`RELEASE_NOTES.md`; new entries go directly in this file's Shipped section
going forward (see `PORTFOLIO_STANDARDS.md`).

Status key: ✅ Built · 🔨 In progress / partial · ⏳ Not started.

## Shipped

### v1.0.0 — First production release ✅
Google sign-in, Firestore cloud sync, add/clear tasks with notes,
drag-and-drop reordering (desktop + mobile via SortableJS), PWA basics, and
a version footer. This was the first complete, production-ready version of
the app — full detail in `CHANGELOG.md` and `RELEASE_NOTES.md`.

### Repo rename — BAA-001-BarelyThingsToDo
Renamed from `to-do-tomorrow` to match the portfolio's `BAA-###-Name`
convention (first app built, hence `001`). GitHub's repo rename redirects
`github.com` and git URLs automatically, but **not** the GitHub Pages site —
the live app moved from
`https://paul-barelyartificial.github.io/to-do-tomorrow/` to
`https://paul-barelyartificial.github.io/BAA-001-BarelyThingsToDo/`. The old
URL now 404s; any bookmarks or installed PWAs need re-pointing at the new
URL (see `docs/HOSTING.md`).

### v1.1.0 — Personal + shared company list ✅
Added a "My List" / "Company List" switcher. `firebase/firestore.js` is now
scope-agnostic (works against any Firestore collection reference); the
company list lives at `companies/barely-artificial/tasks/{taskId}`,
alongside the existing per-user `users/{userId}/tasks/{taskId}`. Access
control: the Company List tab only appears, and only works, for accounts
signed in with a verified `@barelyartificial.com` email — enforced both in
the UI (tab hidden otherwise) and in `firestore.rules` (so it can't be
bypassed client-side). Added `.claude/launch.json` for local dev preview.
`firestore.rules` is deployed to production (confirmed against the live
rules before deploying).

### v1.2.0 — Company email sign-in (email + password) ✅
Discovered while testing v1.1.0: "sign in with a `@barelyartificial.com`
email" only worked if that email was backed by a real Google account
(Workspace). Paul and Steve have both been signing in with personal Gmail
addresses, so the domain check in v1.1.0 had nothing to match against.
Added a proper fix: `firebase/auth.js` now also supports email/password
sign-in via Firebase Auth directly (no Google account needed for the
company email). Signing in with Google is unaffected and still works
exactly as before for personal use.
- *New accounts* (e.g. Steve): "Create account" with their
  `@barelyartificial.com` email + a password, straight away — no linking
  needed since there's no prior data to preserve.
- *Existing accounts* (Paul, already using a personal Gmail): "Link to my
  account" attaches the company email/password credential to the *same*
  Firebase account/UID as the existing Google sign-in, so the existing
  personal list isn't lost or duplicated. If the linked email differs from
  the account's current primary email, Firebase sends a verification link
  before promoting it to primary (`verifyBeforeUpdateEmail`) — this is
  what the Company List access check (both client-side and
  `firestore.rules`) actually keys off, so access unlocks only once that
  link is clicked.
Email/Password enabled in the Firebase console (manual one-time step).
Verified end-to-end live: Paul linked his `barelyartificial.com` email to
his existing Google-signed-in account, verified it, signed out/back in,
and the Company List tab appeared with his personal list intact. Still
⏳ not started: Steve creating his own account (he has no prior personal
list to preserve, so just "Create account" with his `@barelyartificial.com`
email) and confirming the Company List actually syncs between the two of
them.

## Backlog / ideas

- **Modernize the UI + rename the app to "Barely Things To Do."** Current
  UI is the original v1.0.0 look; wants a visual refresh. Rename touches:
  `index.html` (`<title>`, `apple-mobile-web-app-title`, `<h1>`),
  `manifest.webmanifest` (`name`/`short_name`), `README.md`, and anywhere
  else "To Do Tomorrow" appears in-app (not the historical `CHANGELOG.md`/
  `RELEASE_NOTES.md`, which stay as-is). Renaming the manifest `short_name`
  changes the installed PWA's home-screen label, so existing installs will
  need reinstalling to pick up the new name/icon — same caveat as the repo
  URL change in `docs/HOSTING.md`.

- **Edit an existing item.** Open a previously created task and edit its
  title and notes in place, rather than clear-and-re-add. Natural pairing
  with the "open item" interaction the app already has for notes.

- **Undo after clearing.** A brief "Undo" toast instead of an instant
  permanent delete — forgives a mis-tap without building out a full
  trash/archive.

- **Swipe-to-clear on mobile.** Swipe a task away instead of opening it to
  delete. Faster, and matches the drag-and-drop interaction already there.

- **Keyboard-only flow on desktop.** Type, Enter to add, arrow keys to
  reorder the focused item — no mouse needed for the whole workflow.

- **Item count in the footer.** e.g. "7 things to do," next to the version
  number. No new concepts, just a glance-metric.

- **Offline-first PWA.** Currently installable but still needs network for
  Firestore reads/writes; queue adds/reorders locally and sync when back
  online so it's actually usable offline, not just installable.

- **Plain-text export.** Dump the current list, in order, as text — useful
  for sharing or backup without introducing any structure beyond what's
  already there.

- **Decorative priority color on each card.** A card's outline color
  signals Red (High) / Amber (Medium) / Blue (everything else, default).
  Purely visual — doesn't sort, filter, or group the list; order in the
  list is still the only real priority (see Product philosophy in
  `AGENTS.md`). Data model: add a `priority` field (`red` | `amber` |
  `blue`) to each task, defaulting to `blue`.
  - *New items*: a row of three small color-dot buttons in the add form,
    `blue` pre-selected, tap/click red or amber to override before adding.
  - *Existing ("legacy") items*: expose the same three-dot picker as part
    of the "edit an existing item" interaction above (opening a card to
    edit title/notes is the natural place to also change its color), rather
    than adding a separate edit mode just for color.

- **Top-priority summary paragraph near the top of the UI.** Long-term
  item, depends on the priority-color feature above landing first. Looks at
  all Red items, then all Amber items, then the highest (first-ordered) 5
  Blue items, and renders a readable paragraph of what needs doing.
  Two-phase, by design:
  - *Phase 1 (do first)*: templated, no AI. Plain JS string-building from
    the selected items — no backend, no API cost, stays entirely within
    the current static-site architecture.
  - *Phase 2 (later)*: swap in a true AI-generated summary (e.g. via
    Claude). This needs an LLM call, and an API key can't live in
    client-side JS on a static site — it requires a small backend to hold
    the key securely. That's the app's first real backend requirement, and
    is worth revisiting alongside the Cloudflare Worker question below
    rather than bolting on a one-off serverless function.

## Noted but deliberately deferred

- **Due dates, deadlines, and priority sorting/filtering** — deliberately
  out of scope, not just unbuilt. Position in the list, set by reordering,
  is still the only thing that determines what happens first. A purely
  visual, decorative priority cue (see the card-outline-color Backlog item
  below) is the one carve-out — it doesn't sort, filter, or gate
  reordering. See the Product philosophy section in `AGENTS.md`. Don't
  re-propose sorting/dates/deadlines from scratch — if the thinking
  changes, update this entry with the reasoning rather than silently
  building it.

- **Multiple named lists** (beyond Personal/Company, e.g. "Groceries,"
  "Project X") — considered and set aside for now. It's the first step
  toward a list-of-lists structure, which pulls against the "one simple
  ordered list" premise (see Product philosophy in `AGENTS.md`). Revisit
  only if Personal + Company genuinely isn't enough in practice.

- **Migrating to the portfolio's standard architecture** (Cloudflare Worker
  + Hono + D1/Drizzle + Tailwind v4) — deferred. This app predates that
  standard and works fine as a static Firebase-backed site; migrating would
  mean rebuilding auth and the data layer from scratch (and migrating
  existing task data out of Firestore) for a payoff that's consistency, not
  new functionality. Revisit if there's a concrete driver — e.g. wanting a
  unified `barelyartificial.com` domain instead of the `github.io` subpath,
  or SSO shared across BA apps — not just to match the pattern.
