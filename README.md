# To Do Tomorrow

**To Do Tomorrow** is a calm, minimalist task app by **Barely Artificial**.

It is designed to do one thing well: capture the things that need doing tomorrow, keep them in the order that matters, and sync them across devices.

Current release: **v1.0.0**

---

## Features

- Google sign-in
- Cloud sync using Firebase Firestore
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

For Firebase authentication and Firestore testing, use the deployed GitHub Pages URL or run through a local web server. Firebase Authentication requires an authorised domain.

---

## Deployment

The app is deployed using **GitHub Pages** from the `main` branch and root folder.

Release checklist:

1. Test locally where possible.
2. Update the version number.
3. Commit changes.
4. Push to GitHub.
5. Wait for GitHub Pages deployment to complete.
6. Hard refresh the live app.
7. Confirm the footer version matches the release.

---

## Firebase

The app uses:

- Firebase Authentication for Google sign-in
- Firestore for cloud task storage
- Firestore security rules to restrict access to the signed-in user's own task collection

Task data is stored under:

```text
users/{userId}/tasks/{taskId}
```

---

## Author

Built by **Barely Artificial**.

https://www.barelyartificial.com
