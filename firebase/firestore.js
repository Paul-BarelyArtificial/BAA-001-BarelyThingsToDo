import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

import { app } from "./config.js?v=1.5.0";

export const db = getFirestore(app);

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
  await addDoc(tasksRef, {
    title: task.title,
    notes: task.notes,
    priority: task.priority || "blue",
    order: Date.now(),
    createdAt: serverTimestamp()
  });
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
