import {
  signInWithGoogle,
  signOutUser,
  watchAuth
} from "../firebase/auth.js";

import {
  watchTasks,
  saveTask as saveCloudTask,
  deleteTask as deleteCloudTask,
  updateTaskOrder
} from "../firebase/firestore.js";

const APP_VERSION = "v0.3.3";

const taskTitleInput = document.querySelector("#task-title");
const taskNotesInput = document.querySelector("#task-notes");
const toggleNotesButton = document.querySelector("#toggle-notes");
const addTaskButton = document.querySelector("#add-task");
const taskList = document.querySelector("#task-list");
const emptyState = document.querySelector("#empty-state");
const charCount = document.querySelector("#char-count");
const signInButton = document.querySelector("#sign-in");
const signOutButton = document.querySelector("#sign-out");
const authStatus = document.querySelector("#auth-status");
const appVersion = document.querySelector("#app-version");

let tasks = [];
let currentUser = null;
let unsubscribeTasks = null;
let draggedTaskId = null;

function renderTasks() {
  taskList.innerHTML = "";
  emptyState.classList.toggle("hidden", tasks.length > 0);

  tasks.forEach((task) => {
    const item = document.createElement("li");
    item.className = "task-card";
    item.draggable = true;
    item.dataset.id = task.id;

    item.innerHTML = `
      <span class="drag-handle" aria-hidden="true">⋮⋮</span>
      <div class="task-content">
        <h2>${escapeHtml(task.title)}</h2>
        ${task.notes ? `<p>${escapeHtml(task.notes)}</p>` : ""}
      </div>
      <button class="clear-button" type="button" aria-label="Clear task">✓</button>
    `;

    taskList.appendChild(item);
  });
}

async function addTask() {
  const title = taskTitleInput.value.trim();
  const notes = taskNotesInput.value.trim();

  if (!title) return;

  if (!currentUser) {
    alert("Please sign in before adding tasks.");
    return;
  }

  await saveCloudTask(currentUser.uid, {
    title,
    notes
  });

  taskTitleInput.value = "";
  taskNotesInput.value = "";
  charCount.textContent = "0 / 100";
  taskTitleInput.focus();
}

async function clearTask(id) {
  if (!currentUser) return;

  const item = taskList.querySelector(`[data-id="${id}"]`);
  if (!item) return;

  item.classList.add("clearing");

  setTimeout(async () => {
    await deleteCloudTask(currentUser.uid, id);
  }, 180);
}

function updateCharacterCount() {
  charCount.textContent = `${taskTitleInput.value.length} / 100`;
}

function toggleNotes() {
  taskNotesInput.classList.toggle("hidden");

  toggleNotesButton.textContent = taskNotesInput.classList.contains("hidden")
    ? "+ Notes"
    : "− Notes";

  if (!taskNotesInput.classList.contains("hidden")) {
    taskNotesInput.focus();
  }
}

function handleDragStart(event) {
  const item = event.target.closest(".task-card");
  if (!item) return;

  draggedTaskId = item.dataset.id;
  item.classList.add("dragging");
}

async function handleDragEnd(event) {
  const item = event.target.closest(".task-card");
  if (!item || !currentUser) return;

  item.classList.remove("dragging");
  draggedTaskId = null;

  saveTaskOrderFromDom();
  await updateTaskOrder(currentUser.uid, tasks);
}

function handleDragOver(event) {
  event.preventDefault();

  const afterElement = getDragAfterElement(taskList, event.clientY);
  const draggingItem = document.querySelector(".dragging");

  if (!draggingItem) return;

  if (afterElement == null) {
    taskList.appendChild(draggingItem);
  } else {
    taskList.insertBefore(draggingItem, afterElement);
  }
}

function getDragAfterElement(container, y) {
  const draggableElements = [
    ...container.querySelectorAll(".task-card:not(.dragging)")
  ];

  return draggableElements.reduce(
    (closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;

      if (offset < 0 && offset > closest.offset) {
        return {
          offset,
          element: child
        };
      }

      return closest;
    },
    {
      offset: Number.NEGATIVE_INFINITY,
      element: null
    }
  ).element;
}

function saveTaskOrderFromDom() {
  const orderedIds = [...taskList.querySelectorAll(".task-card")].map(
    (item) => item.dataset.id
  );

  tasks = orderedIds
    .map((id) => tasks.find((task) => task.id === id))
    .filter(Boolean);
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

addTaskButton.addEventListener("click", addTask);
taskTitleInput.addEventListener("input", updateCharacterCount);

taskTitleInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    addTask();
  }
});

toggleNotesButton.addEventListener("click", toggleNotes);

taskList.addEventListener("click", (event) => {
  const clearButton = event.target.closest(".clear-button");
  if (!clearButton) return;

  const item = clearButton.closest(".task-card");
  clearTask(item.dataset.id);
});

taskList.addEventListener("dragstart", handleDragStart);
taskList.addEventListener("dragend", handleDragEnd);
taskList.addEventListener("dragover", handleDragOver);

signInButton.addEventListener("click", async () => {
  try {
    await signInWithGoogle();
  } catch (error) {
    console.error(error);
    alert("Google sign in failed.");
  }
});

signOutButton.addEventListener("click", async () => {
  await signOutUser();
});

watchAuth((user) => {
  if (unsubscribeTasks) {
    unsubscribeTasks();
    unsubscribeTasks = null;
  }

  if (user) {
    currentUser = user;

    authStatus.textContent = `Hi ${user.displayName}`;
    signInButton.classList.add("hidden");
    signOutButton.classList.remove("hidden");

    unsubscribeTasks = watchTasks(currentUser.uid, (cloudTasks) => {
      tasks = cloudTasks;
      renderTasks();
    });
  } else {
    currentUser = null;
    tasks = [];
    renderTasks();

    authStatus.textContent = "Not signed in";
    signInButton.classList.remove("hidden");
    signOutButton.classList.add("hidden");
  }
});

if (appVersion) {
  appVersion.textContent = APP_VERSION;
}

renderTasks();
taskTitleInput.focus();
