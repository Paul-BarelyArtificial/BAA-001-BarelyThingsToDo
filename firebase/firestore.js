import {
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
  collection,
  addDoc,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

import { app } from "./config.js?v=1.11.0";

// Persistent (IndexedDB-backed) local cache: reads work from cache while
// offline, and writes queue locally and sync automatically once back
// online - no custom offline queue needed, the SDK already does this.
// Single-tab manager: simplest option, fine for an app nobody expects to
// have open in two tabs of the same browser at once.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentSingleTabManager()
  })
});

export const COMPANY_ID = "barely-artificial";

export function personalTasksCollection(userId) {
  return collection(db, "users", userId, "tasks");
}

export function companyTasksCollection() {
  return collection(db, "companies", COMPANY_ID, "tasks");
}

export function watchTasks(tasksRef, callback) {
  return onSnapshot(tasksRef, (snapshot) => {
    const tasks = snapshot.docs.map((document) => ({
      id: document.id,
      ...document.data()
    }));

    tasks.sort((a, b) => {
      const aOrder = a.order ?? 0;
      const bOrder = b.order ?? 0;
      return aOrder - bOrder;
    });

    callback(tasks);
  });
}

export async function saveTask(tasksRef, task) {
  const payload = {
    title: task.title,
    noteLog: task.noteLog || [],
    priority: task.priority || "blue",
    order: Date.now(),
    createdAt: serverTimestamp()
  };

  if (task.assignedTo !== undefined) {
    payload.assignedTo = task.assignedTo;
  }

  await addDoc(tasksRef, payload);
}

export async function deleteTask(tasksRef, taskId) {
  await deleteDoc(doc(tasksRef, taskId));
}

export async function archiveTask(tasksRef, taskId) {
  await updateDoc(doc(tasksRef, taskId), { archivedAt: serverTimestamp() });
}

export async function restoreTask(tasksRef, taskId) {
  await updateDoc(doc(tasksRef, taskId), { archivedAt: deleteField() });
}

export async function updateTask(tasksRef, taskId, updates) {
  await updateDoc(doc(tasksRef, taskId), updates);
}

export async function updateTaskOrder(tasksRef, tasks) {
  const updates = tasks.map((task, index) => {
    return updateDoc(doc(tasksRef, task.id), {
      order: index
    });
  });

  await Promise.all(updates);
}

// The per-user profile doc (parent of users/{userId}/tasks, which never
// had a parent doc of its own until this). Only field used so far is
// dailyNotificationsEnabled - the scheduled Cloud Function that actually
// sends the email reads this same collection directly via the Admin SDK.
export function userProfileRef(userId) {
  return doc(db, "users", userId);
}

export function watchUserProfile(userId, callback) {
  return onSnapshot(userProfileRef(userId), (snapshot) => {
    callback(snapshot.exists() ? snapshot.data() : {});
  });
}

export async function setDailyNotifications(userId, enabled) {
  await setDoc(
    userProfileRef(userId),
    { dailyNotificationsEnabled: enabled },
    { merge: true }
  );
}
