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

### v1.5.0 — Top-priority summary paragraph (Phase 1: templated) 🔨
A readable paragraph near the top of the UI, above the add-task form:
looks at all Red items, then all Amber items, then the first 5 Blue
items (in list order), and renders what needs doing as a sentence —
e.g. *"Your top priorities are **Fix invoice bug** and **Call the
supplier** (high priority), plus **Update the roadmap** (medium
priority). Further down: Renew the domain, Book the venue, and Email
Steve."* Task names matching their priority color (red/amber titles
tinted to match their card outline; blue titles just bold, no color,
since blue is the default/no-signal case).
- Phase 1 only, as specced: plain JS string-building in `js/app.js`
  (`buildPrioritySummaryHtml`) — no AI, no backend, no API cost. Phase 2
  (true AI-generated summary) stays in the Backlog below.
- Recomputed every time the task list re-renders, so it always reflects
  whichever list (My List / Company List) is currently shown. Hidden
  entirely when the current list has zero tasks.
- Task titles are HTML-escaped before being wrapped in `<strong>` tags —
  verified a title containing `<img src=x onerror=...>` renders as
  inert escaped text, not executable markup.
Verified with a standalone logic test covering 8 cases (red+amber+blue
mix, red-only, amber-only, blue-only, empty list, singular vs plural
wording, the 6-blue-items truncation to 5, and the HTML-injection
attempt) — all read naturally and escaped correctly. Visual styling
confirmed via injected mock data. Still 🔨 pending: seeing it render
against real signed-in data, same as every round so far.

### v1.6.0 — Move between lists, assignees, undo, swipe, keyboard, footer count 🔨
Five backlog items in one round, all confirmed-shape or quick items.

**Move between lists + "with" assignee + "From Company List" flag:**
- A move (⇄) button on each task card, next to edit/clear, moves it to
  the other list — copy-then-delete across Firestore collections (they're
  separate collections with separate `order` sequences), landing at the
  end of the destination list. Only shown when valid: always on the
  Company List (moving to My List needs no special access), and on My
  List only for accounts with Company List access (no point offering a
  move that would just fail).
- `assignedTo` field on company tasks — a single assignee, picked from a
  small hardcoded roster (`COMPANY_MEMBERS` in `js/app.js`: Paul,
  Stephen, or Unassigned), shown as pills in the add form and the inline
  edit form, company scope only. A card shows "With Paul" etc. when set.
- Company items assigned to the signed-in user also show on their My
  List, in a separate "From Company List" section — read-only (no edit/
  clear/drag from there, deliberately, to avoid wiring cross-collection
  actions into a view that's really just a reminder) — switch to the
  Company List to actually act on one. Own Firestore subscription,
  active only when viewing My List with company access.

**Undo after clearing** *(superseded in v1.9.0 — see below)*: clearing a
task now shows a toast ("Cleared 'X' — Undo") instead of deleting
immediately. The Firestore delete is delayed 5s behind the scenes;
clicking Undo within that window cancels it and restores the task.
Found and fixed a real bug while building this: `saveTaskOrderFromDom()`
(used by drag-and-drop) rebuilt `tasks` purely from the current DOM
order, which excludes anything mid-undo-window — a reorder during that
window would have silently dropped the pending-clear task from memory,
breaking Undo. Fixed to preserve it. v1.9.0 replaced this whole
mechanism with 30-day Archive — this entry stays as the historical
record of what shipped at the time.

**Swipe-to-clear on mobile:** swiping a card left past a threshold
triggers the same clear-with-undo flow. Custom touch handling (not
SortableJS, which only owns the drag-handle) that distinguishes
horizontal swipes from vertical scrolling and backs off cleanly if it's
a scroll.

**Keyboard-only flow:** read-only cards are now focusable
(`tabindex="0"`); with one focused, Arrow Up/Down reorders it and
persists via the same `updateTaskOrder()` drag-and-drop already uses.
Enter-to-add already existed from v1.0.0.

**Item count in the footer:** "N things to do" next to the version
number, scoped to whichever list is currently shown, hidden when it's
empty.

Verified: standalone logic tests (reorder splicing, move payload shape
for both directions) all correct; visual styling for every new UI piece
(task-actions row, assignee pills, "With" label, From Company List
section, toast, mobile width) confirmed via injected markup matching the
real render output; assignee-pill click-to-select confirmed interactively
live (doesn't need Firestore). Still 🔨 pending: the full Firestore-backed
flows — move, undo-then-restore, swipe, keyboard reorder — against a real
signed-in account, same as every round so far.

### v1.7.0 — Center header, bolder red/amber, Light/Dark theme switch ✅
Three UI tweaks in one round.

**Centered header:** `.app-header` (brand lockup/logo, `<h1>`, tagline,
auth panel) and the `.list-switcher` tabs below it are now centered
instead of left-aligned — `text-align: center` plus `justify-content:
center` on the flex rows inside; `.list-switcher` changed from
`inline-flex` to `flex` with `width: fit-content; margin: 0 auto` so it
centers independently as a sibling of `.app-header`.

**Bolder red/amber card outlines:** `.task-card[data-priority="red"/
"amber"]`'s resting (non-hover) border went from `rgba(…, 0.5)` at 1px to
`rgba(…, 0.85)` at 2px. Blue left untouched, as asked.

**Light/Dark theme switch:** a sun/moon toggle, fixed top-right of the
page.
- A full light palette designed from scratch (not inverted dark values)
  — every CSS custom property re-specified for contrast against a light
  background, including a new `--accent-contrast` token (button text on
  the accent color needs to flip from near-black to white once the accent
  itself gets darker for light-mode contrast) and `--panel-rgb` (so the
  three different translucent-panel alpha values used around the app stay
  theme-aware via `rgba(var(--panel-rgb), X)` instead of a hardcoded dark
  triplet). Found and fixed several hardcoded dark-only colors while
  auditing the stylesheet for this (panel backgrounds, button text,
  shadow colors) that would have stayed dark-themed even after switching
  to light otherwise.
- Defaults to the device's `prefers-color-scheme`; an explicit toggle
  choice is remembered in `localStorage` and overrides it from then on.
  A small inline script in `index.html`'s `<head>` (before the deferred
  module script) applies any stored choice immediately, to avoid a flash
  of the wrong theme on load.
- Priority colors (red/amber/blue) intentionally stay the same across
  both themes — not redesigned per-theme, kept simple.
Verified interactively, live, in the browser: toggled both directions,
confirmed persistence across a reload with no flash of the wrong theme,
confirmed the bolder red/amber outlines render correctly in both themes,
checked mobile width. This is the first round where the actual visual
change could be fully verified without needing a signed-in account, since
none of it touches Firestore.

### v1.8.0 — Offline-first PWA + plain-text export ✅
**Offline-first:** the app previously needed network for every Firestore
read/write despite being installable. Rather than hand-building a custom
local write-queue, enabled Firestore's own built-in offline support:
- `firebase/firestore.js` switched from `getFirestore(app)` to
  `initializeFirestore(app, { localCache: persistentLocalCache({...}) })`
  — reads now work from an IndexedDB-backed cache while offline, and
  writes queue locally and sync automatically on reconnect, with no
  custom queue code needed at all. Single-tab persistence only
  (`persistentSingleTabManager()`), a deliberate simplification.
- New `sw.js` separately caches the static app shell (HTML/CSS/JS/images)
  via the Cache API, so the *page itself* can load with no network at
  all — cache-first for `?v=`-versioned assets, network-first-with-
  fallback for everything else. Only touches same-origin requests;
  Firebase/gstatic calls pass straight through untouched.
- An offline banner ("You're offline — changes will sync once you're back
  online") shows/hides based on `navigator.onLine` + the `online`/
  `offline` window events.
- Updated `docs/HOSTING.md` and `AGENTS.md`'s definition of done: `sw.js`'s
  `CACHE_NAME` is now part of the cache-busting checklist every release
  has to bump together, same category of thing as the ES module imports
  (missing it would leave offline users on a stale app shell forever,
  quietly, same failure shape as the v1.3.1 bug).

**Plain-text export:** an "Export" link in the footer copies the current
list (whichever one's showing — My List or Company List), in order, as
plain text to the clipboard — numbered, with any notes indented
underneath, headed by the list name and today's date. Falls back to a
`prompt()` with the text pre-filled if the Clipboard API is unavailable
or denied. Reuses the existing toast system for the confirmation (or
"Nothing to export yet" if the list's empty).

Verified: `firebase/firestore.js`'s new initialization loads with no
console errors; the plain-text builder logic confirmed via a standalone
test (multi-item, single-item, notes mixed in, empty-list edge case);
the Export button confirmed live end-to-end on the empty-list path
(button → toast). Offline banner show logic confirmed by forcing it
visible and checking the rendered state. Service worker *registration*
couldn't be confirmed against the local-dev-server preview (it blocked
registration outright — confirmed via a trivial guaranteed-valid test
service worker failing identically there) but **is confirmed working
against the real deployed site**: registered, reached `activated` state,
and correctly populated the `barely-things-to-do-v1.8.0` cache with the
full app shell (`index.html`, manifest, all icon images), no console
errors. Still open: the populated-list clipboard-write export path needs
a signed-in account with real tasks to exercise, same as most rounds, and
genuinely offline behaviour (airplane mode, not just the dev-tools
simulation) is worth a real check when convenient.

### v1.9.0 — Archive completed tasks (30 days, restorable) 🔨
Clearing a task (✓) now archives it instead of deleting it. Decided with
Paul before building (2026-10-21):
- The 5s Undo toast from v1.6.0 is **gone** — Archive replaces it
  entirely as the one undo mechanism, rather than two overlapping ones.
  Clearing is now a direct `archivedAt: serverTimestamp()` flag, no
  pending-delete window.
- 30-day expiry via **client-side cleanup**, not a Firestore TTL policy —
  no Firebase console setup needed. Runs every time the current list's
  snapshot updates (so, in practice, whenever anyone has the app open),
  checking each archived task's `archivedAt` against
  `ARCHIVE_EXPIRY_MS` and permanently deleting anything past it.
- Data model: no copy/move at all — an archived task just stays in its
  own collection (`users/{uid}/tasks` or
  `companies/barely-artificial/tasks`), flagged with `archivedAt`.
  "Restore to the original list" falls out for free since it never left;
  `firebase/firestore.js` gained `archiveTask()`/`restoreTask()`
  alongside the existing `deleteTask()`. Restored items reappear at
  their old `order` value, which may now sit oddly among tasks that
  moved while archived — an accepted minor quirk, not solved for.
- Access point: an "Archive" link in the footer next to Export (not a
  third tab, which would compete for visual priority for something used
  rarely) opens a modal — scoped to whichever list is currently active,
  closable via its Close button, clicking the backdrop, or Escape.
  Each archived item shows title, notes, how long ago it was archived,
  and a Restore button.
- `showToast()` lost its now-unused action-button parameter (nothing
  calls it with one anymore) — removed the dead `#toast-action` markup/
  CSS along with it, rather than leaving unused plumbing in place.
Verified live in the browser: Archive modal opens/closes all three ways
(button, backdrop, Escape), correctly scoped to "My List" in its
sublabel; populated-list layout (priority-colored outline, notes,
archived-date, Restore button) confirmed via injected markup matching
the real render output; clearing a task while signed out correctly no-ops
with no error and no stray toast, confirming the old undo-toast path is
really gone. Still 🔨 pending: the full archive → 30-day-window →
restore cycle against real signed-in data, same as most rounds — this
one's particularly hard to verify quickly since the 30-day expiry can't
be meaningfully fast-forwarded in testing.

### v1.10.0 — Audit trail on notes 🔨
Paul: *"I'd like an audit trail on the notes for an item so that you can
add notes to an item without deleting the previous notes. This means that
you can work on an item over a period of time and have a record of what
you've done."* Notes are now a running log instead of a single
overwritable string.
- Data model: `notes` (string) replaced by `noteLog` (array of
  `{ text, createdAt }`, oldest first) — `firebase/firestore.js`'s
  `saveTask()` always writes `noteLog`. Legacy tasks with the old `notes`
  string (everything created before this release) aren't migrated in
  Firestore; `js/app.js`'s new `getNoteLog()` reads either shape
  transparently, treating an old `notes` value as a single entry dated
  "Before audit trail". The first edit that adds a new note on a legacy
  task carries the old note forward as the log's first real entry and
  writes the array going forward — a one-way, lazy migration, no backfill
  script needed.
- Editing a task: the inline edit card's Notes section now shows the full
  history (date-stamped, oldest to newest, scrollable past a few entries)
  above an always-empty "Add a note..." textarea — typing and saving
  *appends* a new entry rather than overwriting the log, and saving with
  nothing typed leaves the history untouched. Read-only cards (and the
  Company List "From Company List" section, and the Archive modal) still
  show only the latest note, same as before — the full history is only
  surfaced where you'd actually act on it, in the edit view.
- Plain-text export (`buildPlainTextExport`) now lists every note in a
  task's history under its title, each tagged with its date (or "Before
  audit trail" for the pre-migration entry) — previously only the single
  current note.
- Found and fixed a pre-existing, unrelated bug while in this code: the
  Notes-toggle button on an editing card held a stale DOM reference after
  `renderTasks()` rebuilt the list, so re-focusing the textarea after
  opening Notes would silently no-op. Fixed by re-querying the fresh node
  after re-render instead of reusing the pre-render one.
Verified: a standalone logic test (legacy-task normalization, appending to
a legacy task carries its old note forward, brand-new task starts empty,
multi-entry ordering stays oldest-first, saving an empty note is a no-op,
a task with neither field returns an empty log) — all passed. Visually
confirmed via an injected mock editing card matching the real render
output: three-entry history displays correctly (legacy entry labelled
"Before audit trail", two dated entries), scrolls once it overflows, empty
textarea sits below it; a mock read-only card confirmed it shows only the
latest note, not the history. No console errors either way. Still 🔨
pending: the real add-note → Save → Firestore → reopen cycle, and the
legacy-note-migration-on-first-edit behaviour, against a real signed-in
account and genuinely old data — same category of thing that's needed
Paul's own sign-in to confirm every round so far.

### Custom domain — todo.barelyartificial.app ✅
Moved off the GitHub Pages default URL to match the rest of the
portfolio's `xxxxx.barelyartificial.app` convention:
- `CNAME` file added at the repo root (`todo.barelyartificial.app`).
- DNS: Paul added a `CNAME` record (`todo` → `paul-barelyartificial.github.io`)
  in the `barelyartificial.app` zone on Cloudflare, proxy off — confirmed
  resolving before the `CNAME` file was pushed, specifically to avoid a
  window where the old URL (which GitHub redirects once a custom domain
  is configured) pointed at a domain that didn't resolve yet.
- `todo.barelyartificial.app` added to Firebase Auth's authorized domains
  (Authentication → Settings → Authorized domains) — done manually by
  Paul in the Firebase console, same category as the Email/Password
  provider step in v1.2.0. `paul-barelyartificial.github.io` left in the
  list rather than removed, as a rollback path.
- `docs/HOSTING.md`'s Live URL and Firebase project sections updated to
  match.
No app code changed, so no `VERSION.txt`/footer/cache-busting bump for
this one — same treatment as the earlier repo-rename entry. Verified
live: HTTPS certificate issued, HTTPS enforcement turned on, page loads
and serves the correct version at the new domain, Google sign-in
confirmed working by Paul. Still open: Paul + Stephen each reinstalling
the PWA from the new URL on their own devices, whenever convenient — not
blocking, the browser URL already works.

### v1.11.0 — Daily email notification 🔨
Paul chose the backend approach explicitly when asked (2026-10-21):
Firebase Cloud Functions + Cloud Scheduler, with the function calling the
Resend API directly rather than Firebase's "Trigger Email" extension.
This is the app's first real backend component — see the new Cloud
Functions section in `docs/HOSTING.md` for the full setup.

- **Switch:** a "Daily Notification" toggle near the top of the UI (next
  to the auth panel), signed-in only. Backed by a new `users/{uid}`
  profile doc (`dailyNotificationsEnabled` boolean) —
  `firebase/firestore.js` gained `watchUserProfile()`/
  `setDailyNotifications()`; `firestore.rules` gained a rule for the
  profile doc itself (previously only its `tasks` subcollection had one).
  Deployed and live.
- **Sending:** `functions/sendDailyNotifications` (new `functions/`
  directory, its own `package.json`) — a scheduled Cloud Function
  (currently `0 8 * * *` Europe/London, a placeholder pending Paul's
  confirmation) that queries everyone with the switch on, builds their
  task list (personal + anything assigned to them on the Company List,
  for company accounts), and emails it via Resend. Mirrors the
  client-side `getNoteLog()`/`latestNote()` logic (kept in sync by hand,
  since this runs in Cloud Functions' own Node environment, not the
  browser) so the email shows the same "latest note per task" view as a
  read-only card.
- Billing: Firebase project upgraded to the Blaze plan (needed for Cloud
  Functions at all, even within free-tier usage).
- Resend: `barelyartificial.app` was already verified as a sending domain
  from an earlier project; `FROM_EMAIL` defaults to
  `todo@barelyartificial.app`. `RESEND_API_KEY` is set via Secret Manager
  by Paul directly in his own terminal — never pasted into chat or typed
  into a file in the repo.
Verified: a standalone logic test covering the email-building helpers
(`latestNote`, HTML-escaping, archived-task filtering, order-sorting,
empty-list case) — all passed. The client-side switch's show/hide and
on/off states confirmed visually via mock DOM injection (also caught and
fixed a real CSS specificity bug: `.notification-setting { display: flex
}` was overriding the shared `.hidden` utility class since it was
declared later in the stylesheet with equal specificity — fixed with an
explicit `.notification-setting.hidden` rule, same pattern already used
for `.toast.hidden` and `.archive-modal.hidden`). `firestore.rules`
deployed and live. The Cloud Function itself is **deployed and live**
(`sendDailyNotifications`, `us-central1`) — along the way, upgraded the
Functions runtime from Node.js 20 to 22 (20 was about to be
decommissioned, literally days away) and `firebase-functions` from 6.x to
7.4.0. Confirmed `RESEND_API_KEY` exists in Secret Manager (checked
metadata only via `firebase functions:secrets:get`, never the value
itself) and that the deployed function has been granted access to it.
Send time confirmed with Paul: 8am Europe/London, as originally
defaulted. Still 🔨 pending: nobody has watched it actually fire and
deliver a real email yet — that only happens for real at 8am, or could be
checked sooner with a manual trigger via Cloud Scheduler if wanted.

### Forgot password 🔨
Found live, not drip-fed: Paul tried signing in with
`paul@barelyartificial.com` + password and got "Wrong email or password"
— the account's email/password credential exists (linked back in v1.2.0,
confirmed in the Firebase console), so this was very likely just a
forgotten password, not a missing account. The Firebase console has no
admin-side "reset this user's password" action (by design — the console
shouldn't be able to silently set a password on someone's behalf), and
the app had no self-service way to request one either.
- `firebase/auth.js` gained `resetPassword(email)`
  (`sendPasswordResetEmail`); a "Forgot password?" button added to the
  email-auth form next to Sign in/Create account/Link to my account.
- Firebase's `sendPasswordResetEmail` deliberately doesn't reveal whether
  an account exists for the given address (email enumeration
  protection) — it reports success either way, so the UI's confirmation
  message doesn't promise anything it can't know.
Verified live against production: the empty-email validation message,
and a full round-trip against a nonexistent test address (confirmed it
resolves successfully with no console errors, without sending anything
to a real account). Still 🔨 pending: Paul actually requesting a reset
for his own address and confirming the email arrives and the link works
— deliberately not tested with his real address as part of this
verification, to avoid sending him an unplanned reset email mid-build.

### v1.12.0 — Random dad joke on every page load ✅
Paul wanted something fun at the top of the UI — genuinely random each
time, not picked from a small hardcoded list. Fetches a joke live from
[icanhazdadjoke.com](https://icanhazdadjoke.com) (`fetch` with an
`Accept: application/json` header) — free, no API key, CORS-enabled, so
no backend involvement needed. Shown in italics under the tagline
*(tagline removed in v1.13.0 — see below; the joke now sits directly
under the `<h1>`)*.
- Runs on every page load, not tied to sign-in state (Paul's own
  correction after the first idea: auth persists across visits, so
  "every time I log in" wouldn't actually fire often — "every page load"
  is what he actually wanted).
- No hardcoded fallback list on failure, by design (Paul's explicit
  requirement was "not a hardcoded list") — if the request fails (offline,
  API down, rate-limited), the joke line just stays hidden; logged to
  `console.warn` only, no toast or visible error, consistent with how
  the app already treats non-critical failures.
- `sw.js` needed no changes — it already only intercepts same-origin
  requests, so this cross-origin call passes straight through untouched,
  same as Firebase/gstatic calls already do.
Verified live against the real API (not mocked): confirmed a joke
renders correctly on load, confirmed a second reload shows a genuinely
different joke (actual randomness, not a cached/stuck value), no console
errors either time.

### v1.13.0 — Fix: cleared tasks could flicker back into the list ✅
Paul reported it directly: clicking the tick (✓) to clear a task
sometimes left it in the list, needing a second click — and he could
reliably reproduce a related visual glitch where the task fades out,
briefly reappears, then finally disappears for good.

Root cause: `archiveTask()` writes `archivedAt: serverTimestamp()`. With
offline persistence enabled (since v1.8.0), Firestore's `onSnapshot`
fires *twice* for that one write — immediately with the optimistic local
version (where `archivedAt` is present but resolves to `null`, since the
real server time isn't known yet), then again once the server confirms
the real value. The list filter used `!task.archivedAt`, which treats
that pending `null` the same as "never archived" — so for the brief
window between those two snapshots, the task reappeared in the active
list. If that second, corrected snapshot was ever slow to arrive, it
would look stuck rather than just flickering.

Fix: a new `isArchived(task)` helper checks whether the `archivedAt` key
is *present* (`!== undefined`) rather than *truthy* — the key is only
ever absent for a task that's never been archived; a pending write still
has the key, just with a `null` value until the server resolves it.
Applied everywhere a task's archived/active status is decided: the main
list filter, the archived-list filter, and the "From Company List"
assigned-tasks filter. The functions/ Cloud Function wasn't affected —
it reads via the Admin SDK, which always returns server-resolved data,
never an optimistic local snapshot.

Also removed the "One thing at a time." tagline from under the title, at
Paul's request — the dad joke (v1.12.0) now sits directly under the
`<h1>` instead.

Verified: a standalone logic test reproducing the exact two-snapshot
sequence (pending-null, then server-confirmed) — confirmed the old
`!task.archivedAt` check let the task reappear at the first snapshot
(reproducing the reported bug exactly) and the new `isArchived()` check
excludes it from the very first snapshot (no flicker window at all).
Confirmed in the browser against the real rendering code path (not just
the standalone logic) with injected snapshot data matching Firestore's
actual pending-write shape. No console errors. Still open: watching the
real signed-in flow (not simulated data) over a few clear actions to
confirm the flicker is genuinely gone in practice, same category as
other things needing Paul's own sign-in to fully confirm.

## Noted but deliberately deferred

- **Top-priority summary paragraph — Phase 2 (AI-generated).** Phase 1
  (templated, no AI) shipped in v1.5.0 and Paul's confirmed it's good
  enough as-is (2026-10-21) — the AI-generated version isn't needed.
  Would have swapped the plain string-building for a true AI-generated
  summary (e.g. via Claude), which needs an LLM call and a backend to
  hold the API key securely. A backend now exists (Cloud Functions, added
  in v1.11.0 for the daily email notification), so this would no longer
  need a fresh backend decision the way it did when first deferred — just
  revisit only if Paul actually wants it, not by default.

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
  SSO shared across BA apps, or the backend now needed for the AI-summary
  Phase 2 and daily email notification Backlog items — not just to match
  the pattern.
