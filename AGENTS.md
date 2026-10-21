# Working conventions for this project

## Architecture note
This app predates `PORTFOLIO_STANDARDS.md` and does not follow the portfolio's
default Cloudflare Worker stack. It's a plain static HTML/CSS/JS site (no
build step, no package.json) deployed to GitHub Pages, using the Firebase
client SDK directly from the browser for Auth and Firestore. This is a
deliberate deferral, not an oversight — see `docs/ROADMAP.md`'s Deferred
section. Don't migrate it to the Worker stack without asking first; it's a
full rewrite, not a refactor.

## Product philosophy
The whole point of this app is to be the simple to-do manager that others on
the market over-complicate. No due dates, no deadlines, and no priority
*sorting or filtering* — order in the list is still the only thing that
determines what happens first, set by reordering alone.

A purely visual priority cue (e.g. a card's outline color) is fine, as long
as it stays decorative: it must never sort, filter, or group items, and
must never gate reordering. The moment a "priority" concept would change
what order items are acted on beyond manual reordering, it's out — treat it
like due dates/deadlines and put it in `docs/ROADMAP.md`'s Deferred section
with reasoning, rather than building it.

Weigh every feature idea against this before logging it in
`docs/ROADMAP.md`'s Backlog.

## Definition of done
There's no build/lint/type-check tooling here — "done" means:
- Manually tested in a desktop browser (signed in, add/clear/reorder tasks).
- Manually tested in a mobile browser and as the installed PWA.
- Footer version bumped and matches what's deployed.
- Every cache-busting `?v=` query string bumped together — not just
  `index.html`'s `<script>`/`<link>` tags, but the internal ES module
  imports too (`js/app.js` → `firebase/auth.js`/`firebase/firestore.js` →
  `firebase/config.js`), *and* `sw.js`'s `CACHE_NAME` (v1.8.0 on). See
  `docs/HOSTING.md`'s Cache-busting section — missing one of the module
  imports breaks the whole app silently for any returning visitor with a
  stale cache, with no error visible in the UI (this happened for real
  going from v1.2.0 to v1.3.0, fixed in v1.3.1); missing `sw.js`'s
  `CACHE_NAME` leaves offline users on the old app shell indefinitely.

## Roadmap tracking
Keep `docs/ROADMAP.md` with Shipped / Backlog / Deferred sections (see
`PORTFOLIO_STANDARDS.md`), updated every time something ships. Bump
`VERSION.txt` and add a Shipped entry with every round of shipped work, not
just big batches — before committing. `CHANGELOG.md` and `RELEASE_NOTES.md`
hold the pre-standard history (through v1.0.0); new entries go in
`docs/ROADMAP.md` going forward.

When reporting finished work back in chat, lead with the version number and
a short plain-English line on what changed.

## Drip-feed workflow
Default is **log, don't build**: a described issue or feature request goes
into `docs/ROADMAP.md`'s Backlog and stops there, unless the user clearly
asks for a build ("let's build," "build the backlog," naming a specific
item).

## Ask before building, not after
Surface real architecture/product decisions before writing code — especially
anything expensive to reverse later (this app's GitHub Pages + Firebase
hosting included). Give a recommendation with the trade-off, not a raw menu.

## Commit discipline
- Remote: https://github.com/Paul-BarelyArtificial/BAA-001-BarelyThingsToDo
  (public).
- Only commit or push when explicitly asked — never proactively.
- Stage specific files by name; never `git add -A` blindly.
- Descriptive commit messages explaining *why*, ending with:
  `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`
- Prefer new commits over amending existing ones.

## Documentation habits
- Keep `docs/HOSTING.md` current — especially if the GitHub Pages URL or
  Firebase project ever changes again.
- Never print a secret's actual value to terminal/log. Note: the Firebase
  `apiKey` in `firebase/config.js` is a public client identifier, not a
  secret — Firebase security comes from Auth + Firestore rules, not from
  hiding this config.
