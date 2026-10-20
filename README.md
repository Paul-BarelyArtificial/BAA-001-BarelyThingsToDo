# Barely Things To Do

**Barely Things To Do** is a calm, minimalist task app by **Barely Artificial**.

It is designed to do one thing well: capture the things that need doing, keep them in the order that matters, and sync them across devices. No due dates, no deadlines, no priority sorting — the only priority is how far up the list something sits.

Status: **v1.2.0** — personal list, shared company list, Google or company-email sign-in, drag-and-drop ordering, PWA.

---

## Features

- Google sign-in, or email/password sign-in with a `@barelyartificial.com` address
- Cloud sync using Firebase Firestore
- A personal "My List" for everyone, plus a shared "Company List" visible to anyone signed in with a `@barelyartificial.com` email
- Add tasks with optional notes
- Clear tasks when no longer needed
- Drag-and-drop task ordering
- Mobile-friendly reordering using SortableJS
- Responsive dark interface
- Barely Artificial branding
- Installable as a Progressive Web App
- Version footer for deployment checking

---

## Technology

- HTML5
- CSS3
- JavaScript ES Modules
- Firebase Authentication
- Firebase Firestore
- GitHub Pages
- SortableJS

---

## Running Locally

Open `index.html` in a browser for simple UI testing.

For Firebase authentication and Firestore testing, use the deployed GitHub Pages URL or run through a local web server (`.claude/launch.json` has a config for this). Firebase Authentication requires an authorised domain.

See `docs/HOSTING.md` for the full hosting/deployment runbook.

---

## Firebase

The app uses:

- Firebase Authentication — Google sign-in, and email/password sign-in for `@barelyartificial.com` addresses
- Firestore for cloud task storage
- Firestore security rules (`firestore.rules`, deployed via the Firebase CLI) restricting each collection to the right people

Task data is stored under:

```text
users/{userId}/tasks/{taskId}            — personal lists, one per signed-in user
companies/barely-artificial/tasks/{taskId} — the shared Company List
```

---

## Project docs

- `AGENTS.md` — working conventions, product philosophy, commit discipline
- `docs/ROADMAP.md` — what's shipped, backlog, and deliberately deferred
- `docs/HOSTING.md` — stack, local dev, deployment process
- `CHANGELOG.md` / `RELEASE_NOTES.md` — historical record through v1.0.0

---

## Author

Built by **Barely Artificial**.

https://www.barelyartificial.com
