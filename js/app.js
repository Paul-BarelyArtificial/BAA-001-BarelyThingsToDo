import {
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  linkCompanyEmail,
  signOutUser,
  watchAuth
} from "../firebase/auth.js";

import {
  personalTasksCollection,
  companyTasksCollection,
  watchTasks,
  saveTask as saveCloudTask,
  deleteTask as deleteCloudTask,
  updateTask as updateCloudTask,
  updateTaskOrder
} from "../firebase/firestore.js";

const APP_VERSION = "v1.3.0";
const COMPANY_EMAIL_DOMAIN = "barelyartificial.com";

const taskEntrySection = document.querySelector("#task-entry");
const taskEntryLabel = document.querySelector("#task-entry-label");
const taskTitleInput = document.querySelector("#task-title");
const taskNotesInput = document.querySelector("#task-notes");
const toggleNotesButton = document.querySelector("#toggle-notes");
const cancelEditButton = document.querySelector("#cancel-edit");
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
const toggleEmailAuthButton = document.querySelector("#toggle-email-auth");
const emailAuthForm = document.querySelector("#email-auth-form");
const emailAuthEmailInput = document.querySelector("#email-auth-email");
const emailAuthPasswordInput = document.querySelector("#email-auth-password");
const emailSignInButton = document.querySelector("#email-sign-in");
const emailSignUpButton = document.querySelector("#email-sign-up");
const emailLinkButton = document.querySelector("#email-link");
const emailAuthStatus = document.querySelector("#email-auth-status");

let tasks = [];
let currentUser = null;
let currentScope = "personal";
let unsubscribeTasks = null;
let draggedTaskId = null;
let editingTaskId = null;

function hasCompanyAccess(user) {
  if (!user || !user.email || !user.emailVerified) return false;
  return user.email.toLowerCase().endsWith(`@${COMPANY_EMAIL_DOMAIN}`);
}

const EMAIL_AUTH_ERROR_MESSAGES = {
  "auth/invalid-email": "That doesn't look like a valid email address.",
  "auth/user-not-found": "No account found for that email. Try “Create account” instead.",
  "auth/wrong-password": "Wrong password.",
  "auth/invalid-credential": "Wrong email or password.",
  "auth/email-already-in-use": "An account already exists for that email. Try “Sign in” instead.",
  "auth/credential-already-in-use": "That email is already linked to a different account.",
  "auth/weak-password": "Password must be at least 6 characters.",
  "auth/requires-recent-login": "Please sign out and back in, then try linking again.",
  "auth/operation-not-allowed": "Email sign-in isn't turned on yet — ask an admin to enable it in the Firebase console."
};

function emailAuthErrorMessage(error) {
  return EMAIL_AUTH_ERROR_MESSAGES[error.code] || "Something went wrong. Please try again.";
}

function setEmailAuthStatus(message) {
  emailAuthStatus.textContent = message;
}

function updateEmailAuthVisibility() {
  const signedIn = Boolean(currentUser);
  const alreadyHasCompanyAccess = hasCompanyAccess(currentUser);

  emailSignInButton.classList.toggle("hidden", signedIn);
  emailSignUpButton.classList.toggle("hidden", signedIn);
  emailLinkButton.classList.toggle("hidden", !signedIn || alreadyHasCompanyAccess);

  if (alreadyHasCompanyAccess) {
    emailAuthForm.classList.add("hidden");
    toggleEmailAuthButton.classList.add("hidden");
  } else {
    toggleEmailAuthButton.classList.remove("hidden");
  }
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

    if (editingTaskId && !tasks.some((task) => task.id === editingTaskId)) {
      exitEditMode();
    }

    renderTasks();
  });
}

function setScope(scope) {
  if (scope === currentScope) return;
  if (scope === "company" && !hasCompanyAccess(currentUser)) return;

  exitEditMode();
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
    item.classList.toggle("editing", task.id === editingTaskId);
    item.dataset.id = task.id;

    item.innerHTML = `
      <span class="drag-handle" aria-hidden="true">⋮⋮</span>
      <div class="task-content">
        <h2>${escapeHtml(task.title)}</h2>
        ${task.notes ? `<p>${escapeHtml(task.notes)}</p>` : ""}
      </div>
      <div class="task-actions">
        <button class="edit-button" type="button" aria-label="Edit task">✎</button>
        <button class="clear-button" type="button" aria-label="Clear task">✓</button>
      </div>
    `;

    taskList.appendChild(item);
  });
}

function enterEditMode(task) {
  editingTaskId = task.id;

  taskTitleInput.value = task.title;
  taskNotesInput.value = task.notes || "";
  updateCharacterCount();

  if (task.notes) {
    taskNotesInput.classList.remove("hidden");
    toggleNotesButton.textContent = "− Notes";
  }

  taskEntrySection.classList.add("editing");
  taskEntryLabel.textContent = "Edit task";
  addTaskButton.textContent = "Save";
  cancelEditButton.classList.remove("hidden");

  renderTasks();

  taskTitleInput.focus();
  taskTitleInput.select();
}

function exitEditMode() {
  if (!editingTaskId) return;

  editingTaskId = null;

  taskEntrySection.classList.remove("editing");
  taskEntryLabel.textContent = "What needs doing tomorrow?";
  addTaskButton.textContent = "Add";
  cancelEditButton.classList.add("hidden");

  taskTitleInput.value = "";
  taskNotesInput.value = "";
  taskNotesInput.classList.add("hidden");
  toggleNotesButton.textContent = "+ Notes";
  charCount.textContent = "0 / 100";

  renderTasks();
}

async function saveEditedTask() {
  const title = taskTitleInput.value.trim();
  const notes = taskNotesInput.value.trim();

  if (!title) return;

  const tasksRef = currentTasksRef();
  if (!tasksRef || !editingTaskId) return;

  await updateCloudTask(tasksRef, editingTaskId, { title, notes });
  exitEditMode();
  taskTitleInput.focus();
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

addTaskButton.addEventListener("click", () => {
  if (editingTaskId) {
    saveEditedTask();
  } else {
    addTask();
  }
});

taskTitleInput.addEventListener("input", updateCharacterCount);

taskTitleInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();

    if (editingTaskId) {
      saveEditedTask();
    } else {
      addTask();
    }
  }
});

toggleNotesButton.addEventListener("click", toggleNotes);

cancelEditButton.addEventListener("click", () => {
  exitEditMode();
  taskTitleInput.focus();
});

taskList.addEventListener("click", (event) => {
  const clearButton = event.target.closest(".clear-button");
  if (clearButton) {
    const item = clearButton.closest(".task-card");
    clearTask(item.dataset.id);
    return;
  }

  const editButton = event.target.closest(".edit-button");
  if (editButton) {
    const item = editButton.closest(".task-card");
    const task = tasks.find((candidate) => candidate.id === item.dataset.id);
    if (task) enterEditMode(task);
  }
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
  exitEditMode();

  if (user) {
    authStatus.textContent = `Hi ${user.displayName || user.email}`;
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

  updateEmailAuthVisibility();
  subscribeToCurrentList();
});

toggleEmailAuthButton.addEventListener("click", () => {
  emailAuthForm.classList.toggle("hidden");

  toggleEmailAuthButton.textContent = emailAuthForm.classList.contains("hidden")
    ? "+ Use company email"
    : "− Use company email";
});

emailSignInButton.addEventListener("click", async () => {
  const email = emailAuthEmailInput.value.trim();
  const password = emailAuthPasswordInput.value;

  if (!email || !password) {
    setEmailAuthStatus("Enter your email and password.");
    return;
  }

  try {
    setEmailAuthStatus("Signing in…");
    await signInWithEmail(email, password);
    setEmailAuthStatus("");
    emailAuthPasswordInput.value = "";
  } catch (error) {
    console.error(error);
    setEmailAuthStatus(emailAuthErrorMessage(error));
  }
});

emailSignUpButton.addEventListener("click", async () => {
  const email = emailAuthEmailInput.value.trim();
  const password = emailAuthPasswordInput.value;

  if (!email || !password) {
    setEmailAuthStatus("Enter your email and password.");
    return;
  }

  try {
    setEmailAuthStatus("Creating account…");
    await signUpWithEmail(email, password);
    setEmailAuthStatus("Account created. Check your inbox to verify your email.");
    emailAuthPasswordInput.value = "";
  } catch (error) {
    console.error(error);
    setEmailAuthStatus(emailAuthErrorMessage(error));
  }
});

emailLinkButton.addEventListener("click", async () => {
  const email = emailAuthEmailInput.value.trim();
  const password = emailAuthPasswordInput.value;

  if (!email || !password) {
    setEmailAuthStatus("Enter your barelyartificial.com email and a password.");
    return;
  }

  try {
    setEmailAuthStatus("Linking…");
    await linkCompanyEmail(email, password);
    setEmailAuthStatus(
      `Check your inbox to verify ${email}. Once verified, sign out and back in to unlock the Company List.`
    );
    emailAuthPasswordInput.value = "";
  } catch (error) {
    console.error(error);
    setEmailAuthStatus(emailAuthErrorMessage(error));
  }
});

if (appVersion) {
  appVersion.textContent = APP_VERSION;
}

renderTasks();
taskTitleInput.focus();
