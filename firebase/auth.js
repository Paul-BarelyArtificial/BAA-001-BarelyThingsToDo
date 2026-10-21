import {
  getAuth,
  GoogleAuthProvider,
  EmailAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  linkWithCredential,
  verifyBeforeUpdateEmail,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

import { app } from "./config.js?v=1.12.0";

export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

await setPersistence(auth, browserLocalPersistence);

export function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

export function signInWithEmail(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signUpWithEmail(email, password) {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  await sendEmailVerification(credential.user);
  return credential;
}

// Links an email/password credential to the currently signed-in account
// (e.g. one signed in via Google), rather than creating a second, separate
// account. If the account's primary email differs from the one being
// linked, this also promotes the new email to primary - but only takes
// effect once the user clicks the verification link Firebase sends them,
// which keeps an attacker from hijacking an account by linking an email
// they don't actually control.
export async function linkCompanyEmail(email, password) {
  const credential = EmailAuthProvider.credential(email, password);
  await linkWithCredential(auth.currentUser, credential);

  if (auth.currentUser.email !== email) {
    await verifyBeforeUpdateEmail(auth.currentUser, email);
  } else if (!auth.currentUser.emailVerified) {
    await sendEmailVerification(auth.currentUser);
  }
}

export function resetPassword(email) {
  return sendPasswordResetEmail(auth, email);
}

export function signOutUser() {
  return signOut(auth);
}

export function watchAuth(callback) {
  return onAuthStateChanged(auth, callback);
}
