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

### v1.3.0 — UI modernization, rename, edit existing items 🔨
Three things in one round:
- **Renamed** to "Barely Things To Do" everywhere in-app: `index.html`
  (`<title>`, `apple-mobile-web-app-title`, `<h1>`), `manifest.webmanifest`
  (`name`/`short_name`), `README.md` (also brought fully up to date —
  it still said v1.0.0 and didn't mention the Company List or email
  sign-in). `CHANGELOG.md`/`RELEASE_NOTES.md` left as historical record.
  Found and fixed a real bug while in there: `manifest.webmanifest`'s
  `start_url`/`scope` still pointed at the dead pre-rename
  `/to-do-tomorrow/` path from the earlier repo rename — fixed to
  `/BAA-001-BarelyThingsToDo/`. Renaming the manifest `name`/`short_name`
  changes the installed PWA's home-screen label/icon caption — same
  reinstall caveat as the repo URL change in `docs/HOSTING.md`: an
  already-installed PWA keeps the old label until it's reinstalled from
  the live URL.
- **Light UI polish**: adjusted the `<h1>` sizing/letter-spacing for the
  longer title, added subtle button press feedback and task-card hover
  lift, and a brief fade-in on task cards. Same layout and dark theme
  throughout — not a redesign.
- **Edit an existing item**: an edit (✎) button on each task card, via a
  new `updateTask()` in `firebase/firestore.js`. Editing is cancelled
  automatically if you switch lists, sign out, or the item you're editing
  gets cleared from elsewhere. Initial version reused the top entry form;
  reworked in v1.3.2 (below) to expand inline instead, based on feedback.
Verified locally (no sign-in needed): rename, manifest fix, visual polish,
no console errors, works at mobile width. Still 🔨 pending: the edit
flow itself verified live with a real signed-in account (Firestore
`updateTask` call, cross-device sync) — same category of thing that
needed Paul's own sign-in to confirm for v1.1.0/v1.2.0.

### v1.3.1 — Fix: app silently broken for returning visitors ✅
Paul reported "Sign in with Google" and "Use company email" doing nothing
after refreshing post-v1.3.0. Root cause: `firebase/firestore.js` gained a
new export (`updateTask`) in v1.3.0, but `js/app.js`'s import of it had no
cache-busting query string — only `index.html`'s references to
`js/app.js` itself did. A returning browser with a stale cached
`firebase/firestore.js` (missing `updateTask`) made the whole module fail
to load, silently, with zero event listeners attached and no visible
error — every button just did nothing. Fixed by cache-busting *every*
internal ES module import (`js/app.js` → `firebase/auth.js` /
`firebase/firestore.js` → `firebase/config.js`), not just the entry
point. Documented as a required step in `docs/HOSTING.md`'s new
Cache-busting section and added to `AGENTS.md`'s definition of done, so
this class of bug can't recur unnoticed.

### v1.3.2 — Rework edit-item UI: inline card expansion 🔨
Paul tried the v1.3.0 edit feature and gave two pieces of feedback: (1)
editing in the top entry form, away from the card, felt disconnected —
wanted the card itself to expand in place instead; (2) within that form,
"+ Notes" and "Cancel" sat right next to each other with no separation,
reading as "+Notes Cancel". Reworked accordingly:
- The task card being edited now expands inline (title input, notes
  toggle, textarea, Save button, all inside the card itself) instead of
  populating the top "Add a task" form, which now only ever adds new
  tasks again.
- "+/− Notes" and "Cancel" sit at opposite ends of a flex row
  (`justify-content: space-between`) inside the expanded card, fixing the
  spacing complaint directly.
- Typing in the edit fields no longer triggers a full list re-render (which
  would have dropped focus/cursor position on every keystroke) — draft
  title/notes are tracked in state and only the character count updates
  live; the card only fully re-renders on toggling notes, saving, or
  cancelling.
Verified locally: injected a mock editing card matching the exact markup
the app generates, confirmed visually against the layout Paul asked for
(expanded card, accent border, Notes/Cancel at opposite ends, Save bottom
right). Couldn't fully exercise the real click → Firestore `updateTask`
→ re-render path without signing in — same category of thing that's
needed Paul's own sign-in to confirm every round so far.

### v1.4.0 — Decorative priority colors (Red/Amber/Blue) 🔨
A card's outline color now signals Red (High) / Amber (Medium) / Blue
(everything else, default) — purely visual, as specified: doesn't sort,
filter, or group the list, and order in the list is still the only real
priority.
- Data model: `priority` field (`red` | `amber` | `blue`) on each task,
  defaulting to `blue` — `firebase/firestore.js`'s `saveTask()` always
  writes it; legacy tasks without the field render as `blue` via
  `task.priority || "blue"`.
- New tasks: a three-dot color picker in the add form, `blue`
  pre-selected; resets to `blue` after each add (the choice is per-task,
  not a sticky default).
- Existing tasks: the same three-dot picker inside the inline edit form
  from v1.3.2, pre-selected to the task's current color.
- Picking a color updates only the dot states and (for new tasks) nothing
  else live; for the edit form it's tracked in the same draft state as
  title/notes so it survives re-renders without needing a full redraw.
Verified locally: dot picker selection toggling confirmed interactively
in the add form; card outline colors (red/amber/blue, all three
distinguishable against the dark theme) confirmed via injected mock
cards for both read-only and editing states. Still 🔨 pending: the full
add/edit → Firestore → re-render path with a real signed-in account,
same as every round so far.

## Backlog / ideas

- **Move items between My List and Company List, plus a "with" (assignee)
  field on company items, surfaced back on the personal list.** Three
  related pieces:
  - *Move*: an action on a task card to move it from one list to the
    other (both directions, not just personal → company). Mechanically
    this is a copy-then-delete across Firestore collections, not a simple
    update — `users/{uid}/tasks` and `companies/barely-artificial/tasks`
    are different collections, each with their own `order` sequence, so a
    moved item gets a fresh order value (e.g. end of the destination list)
    rather than trying to preserve its old position.
  - *"With" metadata*: an `assignedTo` field on company list items, so a
    task can show who it's with. A single assignee, picked from current
    Company List members (today just Paul and Steve; unassigned is also
    valid) — not free text, not multiple assignees.
  - *Surfaced on personal list*: a company item assigned to the signed-in
    user also appears on their My List, flagged "From Company List," as a
    separate, non-reorderable section (not interleaved with your own
    freely-draggable items) — its real position and order still live on
    the Company List, so reordering/clearing it there is what actually
    changes it.
  Shape confirmed with Paul (2026-10-20) — deliberately kept to the
  simplest version of each piece above rather than anything more
  elaborate. Ready to build as written when picked up.

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

- **Top-priority summary paragraph near the top of the UI.** Long-term
  item. Looks at all Red items, then all Amber items, then the highest
  (first-ordered) 5 Blue items, and renders a readable paragraph of what
  needs doing. Two-phase, by design:
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
