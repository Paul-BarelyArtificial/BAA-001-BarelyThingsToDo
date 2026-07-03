# To Do Tomorrow v1.0.0 Release Notes

## Summary

**To Do Tomorrow v1.0.0** is the first production release of the Barely Artificial task app.

The app began as a simple local browser to-do list and has evolved into a cloud-synchronised web application using Firebase Authentication, Firestore and GitHub Pages.

---

## What Works

- Sign in with Google
- Stay signed in on the same device/browser
- Add tasks
- Add optional notes
- Clear tasks permanently from Firestore
- Reorder tasks on desktop
- Reorder tasks on mobile
- Sync tasks across devices
- Install as a web app / PWA
- Confirm deployed version from the footer

---

## Architecture

```text
GitHub Pages
  └── Static frontend
      ├── HTML
      ├── CSS
      └── JavaScript modules

Firebase
  ├── Authentication
  └── Firestore
      └── users/{userId}/tasks/{taskId}
```

---

## Lessons Learned

- Add visible version numbers early.
- Cache-busting is important on GitHub Pages.
- Firebase configuration is public; security comes from Auth and Firestore rules.
- Firestore deletes must remove cloud records, not just hide tasks in the UI.
- Native browser drag-and-drop is unreliable on mobile; SortableJS is a better fit.
- Test deployment, desktop, mobile browser and installed PWA separately.
- Avoid redesigning architecture mid-sprint; put ideas into a backlog.

---

## Reuse for Future Barely Artificial Apps

This project provides patterns that can be reused in future apps:

- GitHub Pages static hosting
- Firebase Google sign-in
- Firestore per-user data structure
- Dark Barely Artificial branded UI
- Mobile-first PWA approach
- Versioned release workflow

The next project, the Customer Training Portal, should start with a clearer sprint plan and a frozen architecture before implementation begins.
