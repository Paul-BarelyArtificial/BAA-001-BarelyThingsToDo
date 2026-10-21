import {
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

import { app } from "./config.js?v=1.8.0";

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
    notes: task.notes,
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
