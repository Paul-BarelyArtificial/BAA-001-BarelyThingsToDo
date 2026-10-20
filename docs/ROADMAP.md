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

## Backlog / ideas

Nothing logged yet. New feature requests or issues go here per the
drip-feed workflow in `AGENTS.md` — don't build from this list without an
explicit go-ahead.

## Noted but deliberately deferred

- **Migrating to the portfolio's standard architecture** (Cloudflare Worker
  + Hono + D1/Drizzle + Tailwind v4) — deferred. This app predates that
  standard and works fine as a static Firebase-backed site; migrating would
  be a full rewrite with no functional benefit on its own. Revisit only if
  the app needs server-side logic Firestore can't provide, or portfolio
  tooling starts assuming the Worker shape.
