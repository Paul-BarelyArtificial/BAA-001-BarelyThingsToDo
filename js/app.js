import {
  signInWithGoogle,
  signOutUser,
  watchAuth
} from "../firebase/auth.js";

import {
  personalTasksCollection,
  companyTasksCollection,
  watchTasks,
  saveTask as saveCloudTask,
  deleteTask as deleteCloudTask,
  updateTaskOrder
} from "../firebase/firestore.js";

const APP_VERSION = "v1.1.0";
const COMPANY_EMAIL_DOMAIN = "barelyartificial.com";

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
const listTabPersonal = document.querySelector("#list-tab-personal");
const listTabCompany = document.querySelector("#list-tab-company");

let tasks = [];
let currentUser = null;
let currentScope = "personal";
let unsubscribeTasks = null;
let draggedTaskId = null;

function hasCompanyAccess(user) {
  if (!user || !user.email || !user.emailVerified) return false;
  return user.email.toLowerCase().endsWith(`@${COMPANY_EMAIL_DOMAIN}`);
}

function currentTasksRef() {
  if (!currentUser) return null;

  return currentScope === "company"
    ? companyTasksCollection()
    : personalTasksCollection(currentUser.uid);
}

function subscribeToCurrentList() {
  if (unsubscribeTasks) {
    unsubscribeTasks();
    unsubscribeTasks = null;
  }

  const tasksRef = currentTasksRef();
  if (!tasksRef) {
    tasks = [];
    renderTasks();
    return;
  }

  unsubscribeTasks = watchTasks(tasksRef, (cloudTasks) => {
    tasks = cloudTasks;
    renderTasks();
  });
}

function setScope(scope) {
  if (scope === currentScope) return;
  if (scope === "company" && !hasCompanyAccess(currentUser)) return;

  currentScope = scope;

  listTabPersonal.classList.toggle("active", scope === "personal");
  listTabPersonal.setAttribute("aria-selected", scope === "personal");
  listTabCompany.classList.toggle("active", scope === "company");
  listTabCompany.setAttribute("aria-selected", scope === "company");

  subscribeToCurrentList();
}

function renderTasks() {
  taskList.innerHTML = "";
  emptyState.classList.toggle("hidden", tasks.length > 0);

  tasks.forEach((task) => {
    const item = document.createElement("li");
    item.className = "task-card";
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

  const tasksRef = currentTasksRef();

  if (!tasksRef) {
    alert("Please sign in before adding tasks.");
    return;
  }

  await saveCloudTask(tasksRef, {
    title,
    notes
  });

  taskTitleInput.value = "";
  taskNotesInput.value = "";
  charCount.textContent = "0 / 100";
  taskTitleInput.focus();
}

async function clearTask(id) {
  const tasksRef = currentTasksRef();
  if (!tasksRef) return;

  const item = taskList.querySelector(`[data-id="${id}"]`);
  if (!item) return;

  item.classList.add("clearing");

  setTimeout(async () => {
    await deleteCloudTask(tasksRef, id);
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
  const tasksRef = currentTasksRef();
  if (!item || !tasksRef) return;

  item.classList.remove("dragging");
  draggedTaskId = null;

  saveTaskOrderFromDom();
  await updateTaskOrder(tasksRef, tasks);
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

if (window.Sortable) {
  Sortable.create(taskList, {
    handle: ".drag-handle",
    animation: 150,
    delayOnTouchOnly: true,
    delay: 150,
    onEnd: async () => {
      const tasksRef = currentTasksRef();
      if (!tasksRef) return;
      saveTaskOrderFromDom();
      await updateTaskOrder(tasksRef, tasks);
    }
  });
} else {
  console.warn("SortableJS did not load. Task reordering is unavailable.");
}

listTabPersonal.addEventListener("click", () => setScope("personal"));
listTabCompany.addEventListener("click", () => setScope("company"));

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

function resetToPersonalTab() {
  currentScope = "personal";
  listTabPersonal.classList.add("active");
  listTabPersonal.setAttribute("aria-selected", "true");
  listTabCompany.classList.remove("active");
  listTabCompany.setAttribute("aria-selected", "false");
}

watchAuth((user) => {
  currentUser = user;

  if (user) {
    authStatus.textContent = `Hi ${user.displayName}`;
    signInButton.classList.add("hidden");
    signOutButton.classList.remove("hidden");

    listTabCompany.classList.toggle("hidden", !hasCompanyAccess(user));

    if (currentScope === "company" && !hasCompanyAccess(user)) {
      resetToPersonalTab();
    }
  } else {
    listTabCompany.classList.add("hidden");
    resetToPersonalTab();

    authStatus.textContent = "Not signed in";
    signInButton.classList.remove("hidden");
    signOutButton.classList.add("hidden");
  }

  subscribeToCurrentList();
});

if (appVersion) {
  appVersion.textContent = APP_VERSION;
}

renderTasks();
taskTitleInput.focus();
