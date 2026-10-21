import {
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  linkCompanyEmail,
  signOutUser,
  watchAuth
} from "../firebase/auth.js?v=1.5.0";

import {
  personalTasksCollection,
  companyTasksCollection,
  watchTasks,
  saveTask as saveCloudTask,
  deleteTask as deleteCloudTask,
  updateTask as updateCloudTask,
  updateTaskOrder
} from "../firebase/firestore.js?v=1.5.0";

const APP_VERSION = "v1.5.0";
const COMPANY_EMAIL_DOMAIN = "barelyartificial.com";

const taskTitleInput = document.querySelector("#task-title");
const taskNotesInput = document.querySelector("#task-notes");
const toggleNotesButton = document.querySelector("#toggle-notes");
const newPriorityPicker = document.querySelector("#new-priority-picker");
const addTaskButton = document.querySelector("#add-task");
const taskList = document.querySelector("#task-list");
const emptyState = document.querySelector("#empty-state");
const prioritySummary = document.querySelector("#priority-summary");
const prioritySummaryText = document.querySelector("#priority-summary-text");
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
let editDraftTitle = "";
let editDraftNotes = "";
let editDraftPriority = "blue";
let editNotesOpen = false;
let newTaskPriority = "blue";

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
    item.dataset.id = task.id;

    if (task.id === editingTaskId) {
      renderEditingCard(item);
    } else {
      renderReadOnlyCard(item, task);
    }

    taskList.appendChild(item);
  });

  renderPrioritySummary();
}

function joinWithAnd(parts) {
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

function strongTitles(items, color) {
  return items.map((task) => {
    const style = color ? ` style="color: ${color}"` : "";
    return `<strong${style}>${escapeHtml(task.title)}</strong>`;
  });
}

function buildPrioritySummaryHtml(currentTasks) {
  const red = currentTasks.filter((task) => (task.priority || "blue") === "red");
  const amber = currentTasks.filter((task) => (task.priority || "blue") === "amber");
  const blue = currentTasks
    .filter((task) => (task.priority || "blue") === "blue")
    .slice(0, 5);

  const leadParts = [];

  if (red.length > 0) {
    const noun = red.length === 1 ? "priority is" : "priorities are";
    leadParts.push(
      `Your top ${noun} ${joinWithAnd(strongTitles(red, "var(--priority-red)"))} (high priority)`
    );
  }

  if (amber.length > 0) {
    if (leadParts.length > 0) {
      leadParts.push(
        `plus ${joinWithAnd(strongTitles(amber, "var(--priority-amber)"))} (medium priority)`
      );
    } else {
      const noun = amber.length === 1 ? "priority is" : "priorities are";
      leadParts.push(
        `Your next ${noun} ${joinWithAnd(strongTitles(amber, "var(--priority-amber)"))} (medium priority)`
      );
    }
  }

  let leadSentence = "";
  if (leadParts.length > 0) {
    leadSentence = `${leadParts.join(", ")}.`;
    leadSentence = leadSentence.charAt(0).toUpperCase() + leadSentence.slice(1);
  }

  let blueSentence = "";
  if (blue.length > 0) {
    const label = leadSentence ? "Further down" : "Next up";
    blueSentence = `${label}: ${joinWithAnd(strongTitles(blue))}.`;
  }

  return [leadSentence, blueSentence].filter(Boolean).join(" ");
}

function renderPrioritySummary() {
  if (tasks.length === 0) {
    prioritySummary.classList.add("hidden");
    prioritySummaryText.innerHTML = "";
    return;
  }

  prioritySummaryText.innerHTML = buildPrioritySummaryHtml(tasks);
  prioritySummary.classList.remove("hidden");
}

function renderReadOnlyCard(item, task) {
  item.className = "task-card";
  item.dataset.priority = task.priority || "blue";

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
}

function renderEditingCard(item) {
  item.className = "task-card editing";

  item.innerHTML = `
    <span class="drag-handle" aria-hidden="true">⋮⋮</span>
    <div class="task-content task-edit-form">
      <input class="edit-title-input" type="text" maxlength="100" autocomplete="off" />

      <div class="priority-picker" role="radiogroup" aria-label="Priority">
        <button class="priority-dot" type="button" data-priority="red" aria-label="High priority"></button>
        <button class="priority-dot" type="button" data-priority="amber" aria-label="Medium priority"></button>
        <button class="priority-dot" type="button" data-priority="blue" aria-label="Default priority"></button>
      </div>

      <div class="edit-toolbar">
        <button class="edit-toggle-notes text-button" type="button">
          ${editNotesOpen ? "− Notes" : "+ Notes"}
        </button>
        <button class="cancel-edit-button text-button" type="button">Cancel</button>
      </div>

      <textarea
        class="edit-notes-input ${editNotesOpen ? "" : "hidden"}"
        rows="3"
        placeholder="Optional notes..."
      ></textarea>

      <div class="edit-actions">
        <span class="edit-char-count">${editDraftTitle.length} / 100</span>
        <button class="save-edit-button" type="button">Save</button>
      </div>
    </div>
  `;

  const titleInput = item.querySelector(".edit-title-input");
  titleInput.value = editDraftTitle;

  const notesInput = item.querySelector(".edit-notes-input");
  notesInput.value = editDraftNotes;

  item.querySelectorAll(".priority-dot").forEach((dot) => {
    dot.classList.toggle("selected", dot.dataset.priority === editDraftPriority);
  });
}

function enterEditMode(task) {
  editingTaskId = task.id;
  editDraftTitle = task.title;
  editDraftNotes = task.notes || "";
  editDraftPriority = task.priority || "blue";
  editNotesOpen = Boolean(task.notes);

  renderTasks();

  const titleInput = taskList.querySelector(
    `[data-id="${task.id}"] .edit-title-input`
  );
  if (titleInput) {
    titleInput.focus();
    titleInput.select();
  }
}

function exitEditMode() {
  if (!editingTaskId) return;

  editingTaskId = null;
  editDraftTitle = "";
  editDraftNotes = "";
  editDraftPriority = "blue";
  editNotesOpen = false;

  renderTasks();
}

async function saveEditedTask() {
  const title = editDraftTitle.trim();
  const notes = editDraftNotes.trim();

  if (!title) return;

  const tasksRef = currentTasksRef();
  if (!tasksRef || !editingTaskId) return;

  await updateCloudTask(tasksRef, editingTaskId, {
    title,
    notes,
    priority: editDraftPriority
  });
  exitEditMode();
}

function setNewTaskPriority(priority) {
  newTaskPriority = priority;

  newPriorityPicker.querySelectorAll(".priority-dot").forEach((dot) => {
    dot.classList.toggle("selected", dot.dataset.priority === priority);
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
    notes,
    priority: newTaskPriority
  });

  taskTitleInput.value = "";
  taskNotesInput.value = "";
  charCount.textContent = "0 / 100";
  setNewTaskPriority("blue");
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

newPriorityPicker.addEventListener("click", (event) => {
  const dot = event.target.closest(".priority-dot");
  if (!dot) return;

  setNewTaskPriority(dot.dataset.priority);
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
    return;
  }

  const saveEditButton = event.target.closest(".save-edit-button");
  if (saveEditButton) {
    saveEditedTask();
    return;
  }

  const priorityDot = event.target.closest(".priority-dot");
  if (priorityDot) {
    editDraftPriority = priorityDot.dataset.priority;

    const item = priorityDot.closest(".task-card");
    item?.querySelectorAll(".priority-dot").forEach((dot) => {
      dot.classList.toggle("selected", dot.dataset.priority === editDraftPriority);
    });
    return;
  }

  const cancelEditButton = event.target.closest(".cancel-edit-button");
  if (cancelEditButton) {
    exitEditMode();
    return;
  }

  const editToggleNotes = event.target.closest(".edit-toggle-notes");
  if (editToggleNotes) {
    editNotesOpen = !editNotesOpen;
    renderTasks();

    const item = editToggleNotes.closest(".task-card");
    const notesInput = item?.querySelector(".edit-notes-input");
    if (notesInput && !notesInput.classList.contains("hidden")) {
      notesInput.focus();
    }
  }
});

taskList.addEventListener("input", (event) => {
  const titleInput = event.target.closest(".edit-title-input");
  if (titleInput) {
    editDraftTitle = titleInput.value;

    const item = titleInput.closest(".task-card");
    const count = item?.querySelector(".edit-char-count");
    if (count) count.textContent = `${editDraftTitle.length} / 100`;
    return;
  }

  const notesInput = event.target.closest(".edit-notes-input");
  if (notesInput) {
    editDraftNotes = notesInput.value;
  }
});

taskList.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;

  const titleInput = event.target.closest(".edit-title-input");
  if (!titleInput) return;

  event.preventDefault();
  saveEditedTask();
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
