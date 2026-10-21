import {
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  linkCompanyEmail,
  resetPassword,
  signOutUser,
  watchAuth
} from "../firebase/auth.js?v=1.11.0";

import {
  personalTasksCollection,
  companyTasksCollection,
  watchTasks,
  saveTask as saveCloudTask,
  deleteTask as deleteCloudTask,
  updateTask as updateCloudTask,
  archiveTask as archiveCloudTask,
  restoreTask as restoreCloudTask,
  updateTaskOrder,
  watchUserProfile,
  setDailyNotifications
} from "../firebase/firestore.js?v=1.11.0";

const APP_VERSION = "v1.11.0";
const COMPANY_EMAIL_DOMAIN = "barelyartificial.com";
const COMPANY_MEMBERS = [
  { email: "paul@barelyartificial.com", name: "Paul" },
  { email: "stephen@barelyartificial.com", name: "Stephen" }
];
const ARCHIVE_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;
const TOAST_DURATION_MS = 5000;
const THEME_STORAGE_KEY = "theme";

const themeToggleButton = document.querySelector("#theme-toggle");
const taskTitleInput = document.querySelector("#task-title");
const taskNotesInput = document.querySelector("#task-notes");
const toggleNotesButton = document.querySelector("#toggle-notes");
const newPriorityPicker = document.querySelector("#new-priority-picker");
const newAssigneePicker = document.querySelector("#new-assignee-picker");
const addTaskButton = document.querySelector("#add-task");
const taskList = document.querySelector("#task-list");
const emptyState = document.querySelector("#empty-state");
const prioritySummary = document.querySelector("#priority-summary");
const prioritySummaryText = document.querySelector("#priority-summary-text");
const assignedSection = document.querySelector("#assigned-section");
const assignedList = document.querySelector("#assigned-list");
const taskCountSpan = document.querySelector("#task-count");
const taskCountSep = document.querySelector("#task-count-sep");
const toast = document.querySelector("#toast");
const toastMessage = document.querySelector("#toast-message");
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
const emailForgotPasswordButton = document.querySelector("#email-forgot-password");
const emailAuthStatus = document.querySelector("#email-auth-status");
const offlineBanner = document.querySelector("#offline-banner");
const exportListButton = document.querySelector("#export-list");
const openArchiveButton = document.querySelector("#open-archive");
const archiveModal = document.querySelector("#archive-modal");
const archiveModalLabel = document.querySelector("#archive-modal-label");
const archiveList = document.querySelector("#archive-list");
const archiveEmpty = document.querySelector("#archive-empty");
const closeArchiveButton = document.querySelector("#close-archive");
const notificationSetting = document.querySelector("#notification-setting");
const dailyNotificationsToggle = document.querySelector("#daily-notifications-toggle");

function getStoredTheme() {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY);
  } catch (error) {
    return null;
  }
}

function setStoredTheme(theme) {
  try {
    if (theme) {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } else {
      localStorage.removeItem(THEME_STORAGE_KEY);
    }
  } catch (error) {
    // localStorage unavailable (private browsing etc.) - theme just
    // won't persist across visits; applyTheme() still works for this one.
  }
}

function currentEffectiveTheme() {
  const stored = getStoredTheme();
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

function updateThemeToggleIcon() {
  const effective = currentEffectiveTheme();
  themeToggleButton.textContent = effective === "light" ? "\u{1F319}" : "☀️";
  themeToggleButton.setAttribute(
    "aria-label",
    effective === "light" ? "Switch to dark theme" : "Switch to light theme"
  );
}

function applyTheme(theme) {
  if (theme === "light" || theme === "dark") {
    document.documentElement.setAttribute("data-theme", theme);
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
  updateThemeToggleIcon();
}

themeToggleButton.addEventListener("click", () => {
  const next = currentEffectiveTheme() === "light" ? "dark" : "light";
  setStoredTheme(next);
  applyTheme(next);
});

applyTheme(getStoredTheme());

function updateOfflineBanner() {
  offlineBanner.classList.toggle("hidden", navigator.onLine);
}

window.addEventListener("online", updateOfflineBanner);
window.addEventListener("offline", updateOfflineBanner);
updateOfflineBanner();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((error) => {
      console.warn("Service worker registration failed:", error);
    });
  });
}

let tasks = [];
let archivedTasks = [];
let currentUser = null;
let currentScope = "personal";
let unsubscribeTasks = null;
let unsubscribeAssignedTasks = null;
let unsubscribeUserProfile = null;
let assignedToMeTasks = [];
let draggedTaskId = null;
let editingTaskId = null;
let editDraftTitle = "";
let editDraftNotes = "";
let editDraftPriority = "blue";
let editDraftAssignee = "";
let editNotesOpen = false;
let newTaskPriority = "blue";
let newTaskAssignee = "";
let toastTimeoutId = null;
let swipeState = null;

function hasCompanyAccess(user) {
  if (!user || !user.email || !user.emailVerified) return false;
  return user.email.toLowerCase().endsWith(`@${COMPANY_EMAIL_DOMAIN}`);
}

function assigneeName(email) {
  if (!email) return "";
  const member = COMPANY_MEMBERS.find(
    (candidate) => candidate.email.toLowerCase() === email.toLowerCase()
  );
  return member ? member.name : email;
}

function populateAssigneePicker(container, selected) {
  const pills = [{ email: "", name: "Unassigned" }, ...COMPANY_MEMBERS];

  container.innerHTML = pills
    .map(
      (member) => `
        <button
          class="assignee-pill${member.email === selected ? " selected" : ""}"
          type="button"
          data-assignee="${escapeHtml(member.email)}"
        >${escapeHtml(member.name)}</button>
      `
    )
    .join("");
}

function showToast(message) {
  if (toastTimeoutId) {
    clearTimeout(toastTimeoutId);
    toastTimeoutId = null;
  }

  toastMessage.textContent = message;
  toast.classList.remove("hidden");
  toastTimeoutId = setTimeout(hideToast, TOAST_DURATION_MS);
}

function hideToast() {
  toast.classList.add("hidden");
  if (toastTimeoutId) {
    clearTimeout(toastTimeoutId);
    toastTimeoutId = null;
  }
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
    archivedTasks = [];
    renderTasks();
    renderArchiveList();
    return;
  }

  unsubscribeTasks = watchTasks(tasksRef, (cloudTasks) => {
    tasks = cloudTasks.filter((task) => !task.archivedAt);
    archivedTasks = cloudTasks.filter((task) => task.archivedAt);

    if (editingTaskId && !tasks.some((task) => task.id === editingTaskId)) {
      exitEditMode();
    }

    renderTasks();
    renderArchiveList();
    cleanupExpiredArchivedTasks(tasksRef, archivedTasks);
  });
}

function subscribeToAssignedTasks() {
  if (unsubscribeAssignedTasks) {
    unsubscribeAssignedTasks();
    unsubscribeAssignedTasks = null;
  }

  if (currentScope !== "personal" || !hasCompanyAccess(currentUser)) {
    assignedToMeTasks = [];
    renderAssignedSection();
    return;
  }

  const myEmail = currentUser.email.toLowerCase();

  unsubscribeAssignedTasks = watchTasks(companyTasksCollection(), (companyTasks) => {
    assignedToMeTasks = companyTasks.filter(
      (task) => !task.archivedAt && (task.assignedTo || "").toLowerCase() === myEmail
    );
    renderAssignedSection();
  });
}

function subscribeToUserProfile() {
  if (unsubscribeUserProfile) {
    unsubscribeUserProfile();
    unsubscribeUserProfile = null;
  }

  if (!currentUser) {
    notificationSetting.classList.add("hidden");
    dailyNotificationsToggle.checked = false;
    return;
  }

  notificationSetting.classList.remove("hidden");

  unsubscribeUserProfile = watchUserProfile(currentUser.uid, (profile) => {
    dailyNotificationsToggle.checked = Boolean(profile.dailyNotificationsEnabled);
  });
}

function cleanupExpiredArchivedTasks(tasksRef, archivedTasksList) {
  const now = Date.now();

  archivedTasksList.forEach((task) => {
    const archivedAtMs = task.archivedAt?.toMillis?.();
    if (!archivedAtMs) return; // not yet confirmed by the server - leave it
    if (now - archivedAtMs > ARCHIVE_EXPIRY_MS) {
      deleteCloudTask(tasksRef, task.id);
    }
  });
}

function setScope(scope) {
  if (scope === currentScope) return;
  if (scope === "company" && !hasCompanyAccess(currentUser)) return;

  exitEditMode();
  closeArchive();
  currentScope = scope;

  listTabPersonal.classList.toggle("active", scope === "personal");
  listTabPersonal.setAttribute("aria-selected", scope === "personal");
  listTabCompany.classList.toggle("active", scope === "company");
  listTabCompany.setAttribute("aria-selected", scope === "company");

  newAssigneePicker.classList.toggle("hidden", scope !== "company");
  setNewTaskAssignee("");

  subscribeToCurrentList();
  subscribeToAssignedTasks();
}

function renderTasks() {
  taskList.innerHTML = "";
  emptyState.classList.toggle("hidden", tasks.length > 0);

  tasks.forEach((task) => {
    const item = document.createElement("li");
    item.dataset.id = task.id;

    if (task.id === editingTaskId) {
      renderEditingCard(item, task);
    } else {
      renderReadOnlyCard(item, task);
    }

    taskList.appendChild(item);
  });

  renderPrioritySummary(tasks);
  updateTaskCount(tasks);
}

function getNoteLog(task) {
  if (Array.isArray(task.noteLog)) return task.noteLog;
  if (task.notes) return [{ text: task.notes, createdAt: null }]; // pre-audit-trail legacy note
  return [];
}

function latestNote(task) {
  const log = getNoteLog(task);
  return log.length > 0 ? log[log.length - 1].text : "";
}

function formatNoteDate(ms) {
  if (!ms) return "Before audit trail";
  return new Date(ms).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatArchivedLabel(archivedAtMs) {
  if (!archivedAtMs) return "Archived just now";

  const days = Math.floor((Date.now() - archivedAtMs) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "Archived today";
  if (days === 1) return "Archived 1 day ago";
  return `Archived ${days} days ago`;
}

function renderArchiveList() {
  if (archivedTasks.length === 0) {
    archiveEmpty.classList.remove("hidden");
    archiveList.classList.add("hidden");
    archiveList.innerHTML = "";
    return;
  }

  const sorted = [...archivedTasks].sort((a, b) => {
    const aMs = a.archivedAt?.toMillis?.() ?? 0;
    const bMs = b.archivedAt?.toMillis?.() ?? 0;
    return bMs - aMs;
  });

  archiveList.innerHTML = "";

  sorted.forEach((task) => {
    const item = document.createElement("li");
    item.className = "task-card archive-item";
    item.dataset.id = task.id;
    item.dataset.priority = task.priority || "blue";

    const noteText = latestNote(task);

    item.innerHTML = `
      <div class="task-content">
        <h2>${escapeHtml(task.title)}</h2>
        ${noteText ? `<p>${escapeHtml(noteText)}</p>` : ""}
        <p class="archive-date">${formatArchivedLabel(task.archivedAt?.toMillis?.())}</p>
      </div>
      <button class="restore-button" type="button">Restore</button>
    `;

    archiveList.appendChild(item);
  });

  archiveEmpty.classList.add("hidden");
  archiveList.classList.remove("hidden");
}

function openArchive() {
  archiveModalLabel.textContent = currentScope === "company" ? "Company List" : "My List";
  renderArchiveList();
  archiveModal.classList.remove("hidden");
}

function closeArchive() {
  archiveModal.classList.add("hidden");
}

function updateTaskCount(visibleTasks) {
  if (visibleTasks.length === 0) {
    taskCountSpan.classList.add("hidden");
    taskCountSep.classList.add("hidden");
    return;
  }

  taskCountSpan.textContent =
    visibleTasks.length === 1 ? "1 thing to do" : `${visibleTasks.length} things to do`;
  taskCountSpan.classList.remove("hidden");
  taskCountSep.classList.remove("hidden");
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

function renderPrioritySummary(visibleTasks) {
  if (visibleTasks.length === 0) {
    prioritySummary.classList.add("hidden");
    prioritySummaryText.innerHTML = "";
    return;
  }

  prioritySummaryText.innerHTML = buildPrioritySummaryHtml(visibleTasks);
  prioritySummary.classList.remove("hidden");
}

function renderAssignedSection() {
  if (assignedToMeTasks.length === 0) {
    assignedSection.classList.add("hidden");
    assignedList.innerHTML = "";
    return;
  }

  assignedList.innerHTML = "";

  assignedToMeTasks.forEach((task) => {
    const item = document.createElement("li");
    item.className = "task-card assigned-card";
    item.dataset.priority = task.priority || "blue";

    const noteText = latestNote(task);

    item.innerHTML = `
      <div class="task-content">
        <span class="assigned-badge">From Company List</span>
        <h2>${escapeHtml(task.title)}</h2>
        ${noteText ? `<p>${escapeHtml(noteText)}</p>` : ""}
      </div>
    `;

    assignedList.appendChild(item);
  });

  assignedSection.classList.remove("hidden");
}

function renderReadOnlyCard(item, task) {
  item.className = "task-card";
  item.dataset.priority = task.priority || "blue";
  item.tabIndex = 0;

  const assigneeHtml =
    currentScope === "company" && task.assignedTo
      ? `<p class="task-assignee">With ${escapeHtml(assigneeName(task.assignedTo))}</p>`
      : "";

  const canMove = currentScope === "company" || hasCompanyAccess(currentUser);
  const moveButtonHtml = canMove
    ? `<button class="move-button" type="button" aria-label="${
        currentScope === "company" ? "Move to My List" : "Move to Company List"
      }">⇄</button>`
    : "";

  const noteText = latestNote(task);

  item.innerHTML = `
    <span class="drag-handle" aria-hidden="true">⋮⋮</span>
    <div class="task-content">
      <h2>${escapeHtml(task.title)}</h2>
      ${noteText ? `<p>${escapeHtml(noteText)}</p>` : ""}
      ${assigneeHtml}
    </div>
    <div class="task-actions">
      <button class="edit-button" type="button" aria-label="Edit task">✎</button>
      ${moveButtonHtml}
      <button class="clear-button" type="button" aria-label="Clear task">✓</button>
    </div>
  `;
}

function renderNoteLogHtml(task) {
  const log = getNoteLog(task);
  if (log.length === 0) return "";

  const entries = log
    .map(
      (entry) => `
        <div class="note-entry">
          <p class="note-entry-date">${escapeHtml(formatNoteDate(entry.createdAt))}</p>
          <p class="note-entry-text">${escapeHtml(entry.text)}</p>
        </div>
      `
    )
    .join("");

  return `<div class="note-log">${entries}</div>`;
}

function renderEditingCard(item, task) {
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

      ${
        currentScope === "company"
          ? '<div class="edit-assignee-picker assignee-picker" role="radiogroup" aria-label="Assigned to"></div>'
          : ""
      }

      <div class="edit-toolbar">
        <button class="edit-toggle-notes text-button" type="button">
          ${editNotesOpen ? "− Notes" : "+ Notes"}
        </button>
        <button class="cancel-edit-button text-button" type="button">Cancel</button>
      </div>

      <div class="notes-section ${editNotesOpen ? "" : "hidden"}">
        ${renderNoteLogHtml(task)}
        <textarea
          class="edit-notes-input"
          rows="3"
          placeholder="Add a note..."
        ></textarea>
      </div>

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

  const assigneePicker = item.querySelector(".edit-assignee-picker");
  if (assigneePicker) {
    populateAssigneePicker(assigneePicker, editDraftAssignee);
  }
}

function enterEditMode(task) {
  editingTaskId = task.id;
  editDraftTitle = task.title;
  editDraftNotes = ""; // the box is for adding a NEW note, not editing old ones
  editDraftPriority = task.priority || "blue";
  editDraftAssignee = task.assignedTo || "";
  editNotesOpen = getNoteLog(task).length > 0;

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
  editDraftAssignee = "";
  editNotesOpen = false;

  renderTasks();
}

async function saveEditedTask() {
  const title = editDraftTitle.trim();
  const newNoteText = editDraftNotes.trim();

  if (!title) return;

  const tasksRef = currentTasksRef();
  if (!tasksRef || !editingTaskId) return;

  const task = tasks.find((candidate) => candidate.id === editingTaskId);
  const existingLog = task ? getNoteLog(task) : [];
  const noteLog = newNoteText
    ? [...existingLog, { text: newNoteText, createdAt: Date.now() }]
    : existingLog;

  const updates = { title, noteLog, priority: editDraftPriority };
  if (currentScope === "company") {
    updates.assignedTo = editDraftAssignee;
  }

  await updateCloudTask(tasksRef, editingTaskId, updates);
  exitEditMode();
}

function setNewTaskAssignee(email) {
  newTaskAssignee = email;
  populateAssigneePicker(newAssigneePicker, email);
}

function setNewTaskPriority(priority) {
  newTaskPriority = priority;

  newPriorityPicker.querySelectorAll(".priority-dot").forEach((dot) => {
    dot.classList.toggle("selected", dot.dataset.priority === priority);
  });
}

async function addTask() {
  const title = taskTitleInput.value.trim();
  const noteText = taskNotesInput.value.trim();

  if (!title) return;

  const tasksRef = currentTasksRef();

  if (!tasksRef) {
    alert("Please sign in before adding tasks.");
    return;
  }

  const noteLog = noteText ? [{ text: noteText, createdAt: Date.now() }] : [];
  const payload = { title, noteLog, priority: newTaskPriority };
  if (currentScope === "company") {
    payload.assignedTo = newTaskAssignee;
  }

  await saveCloudTask(tasksRef, payload);

  taskTitleInput.value = "";
  taskNotesInput.value = "";
  charCount.textContent = "0 / 100";
  setNewTaskPriority("blue");
  setNewTaskAssignee("");
  taskTitleInput.focus();
}

function clearTask(id) {
  const tasksRef = currentTasksRef();
  if (!tasksRef) return;

  const item = taskList.querySelector(`[data-id="${id}"]`);
  if (item) item.classList.add("clearing");

  setTimeout(() => {
    archiveCloudTask(tasksRef, id);
  }, 180);
}

async function moveTask(task) {
  const sourceRef = currentTasksRef();
  if (!sourceRef || !currentUser) return;

  const destScope = currentScope === "company" ? "personal" : "company";
  const destRef =
    destScope === "company"
      ? companyTasksCollection()
      : personalTasksCollection(currentUser.uid);

  const payload = {
    title: task.title,
    noteLog: getNoteLog(task),
    priority: task.priority || "blue"
  };
  if (destScope === "company") {
    payload.assignedTo = "";
  }

  await saveCloudTask(destRef, payload);
  await deleteCloudTask(sourceRef, task.id);

  showToast(destScope === "company" ? "Moved to Company List" : "Moved to My List");
}

function buildPlainTextExport(visibleTasks, listLabel) {
  const dateLabel = new Date().toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  const lines = visibleTasks.map((task, index) => {
    const titleLine = `${index + 1}. ${task.title}`;
    const log = getNoteLog(task);
    if (log.length === 0) return titleLine;

    const noteLines = log.map((entry) => {
      const dateTag = entry.createdAt ? `[${formatNoteDate(entry.createdAt)}] ` : "";
      return `   ${dateTag}${entry.text}`;
    });

    return [titleLine, ...noteLines].join("\n");
  });

  return [`${listLabel} — ${dateLabel}`, "", ...lines].join("\n");
}

async function exportList() {
  if (tasks.length === 0) {
    showToast("Nothing to export yet");
    return;
  }

  const listLabel = currentScope === "company" ? "Company List" : "My List";
  const text = buildPlainTextExport(tasks, listLabel);

  try {
    await navigator.clipboard.writeText(text);
    showToast("Copied to clipboard");
  } catch (error) {
    window.prompt("Copy your list:", text);
  }
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

newAssigneePicker.addEventListener("click", (event) => {
  const pill = event.target.closest(".assignee-pill");
  if (!pill) return;

  setNewTaskAssignee(pill.dataset.assignee);
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

  const moveButton = event.target.closest(".move-button");
  if (moveButton) {
    const item = moveButton.closest(".task-card");
    const task = tasks.find((candidate) => candidate.id === item.dataset.id);
    if (task) moveTask(task);
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

  const assigneePill = event.target.closest(".edit-assignee-picker .assignee-pill");
  if (assigneePill) {
    editDraftAssignee = assigneePill.dataset.assignee;

    const picker = assigneePill.closest(".edit-assignee-picker");
    picker?.querySelectorAll(".assignee-pill").forEach((pill) => {
      pill.classList.toggle("selected", pill.dataset.assignee === editDraftAssignee);
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
    // Capture the id before renderTasks() rebuilds the DOM - afterwards
    // this element and its ancestors are detached, so re-query fresh.
    const taskId = editToggleNotes.closest(".task-card")?.dataset.id;
    editNotesOpen = !editNotesOpen;
    renderTasks();

    if (editNotesOpen && taskId) {
      taskList.querySelector(`[data-id="${taskId}"] .edit-notes-input`)?.focus();
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

taskList.addEventListener("keydown", (event) => {
  if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;

  const card = event.target;
  if (!card.classList?.contains("task-card") || card.classList.contains("editing")) return;

  event.preventDefault();
  reorderTaskByKeyboard(card.dataset.id, event.key === "ArrowUp" ? -1 : 1);
});

async function reorderTaskByKeyboard(id, direction) {
  const index = tasks.findIndex((task) => task.id === id);
  if (index === -1) return;

  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= tasks.length) return;

  const reordered = [...tasks];
  const [moved] = reordered.splice(index, 1);
  reordered.splice(newIndex, 0, moved);
  tasks = reordered;

  renderTasks();
  taskList.querySelector(`[data-id="${id}"]`)?.focus();

  const tasksRef = currentTasksRef();
  if (!tasksRef) return;
  await updateTaskOrder(tasksRef, tasks);
}

const SWIPE_CLEAR_THRESHOLD = -80;

taskList.addEventListener(
  "touchstart",
  (event) => {
    const item = event.target.closest(".task-card");
    if (!item || item.classList.contains("editing")) return;
    if (event.target.closest(".drag-handle, button, input, textarea")) return;

    const touch = event.touches[0];
    swipeState = {
      id: item.dataset.id,
      element: item,
      startX: touch.clientX,
      startY: touch.clientY,
      deltaX: 0,
      horizontal: null
    };
    item.style.transition = "none";
  },
  { passive: true }
);

taskList.addEventListener(
  "touchmove",
  (event) => {
    if (!swipeState) return;

    const touch = event.touches[0];
    const deltaX = touch.clientX - swipeState.startX;
    const deltaY = touch.clientY - swipeState.startY;

    if (swipeState.horizontal === null) {
      if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
        swipeState.horizontal = Math.abs(deltaX) > Math.abs(deltaY);
      }
    }

    if (swipeState.horizontal === false) {
      swipeState.element.style.transition = "";
      swipeState = null;
      return;
    }

    if (swipeState.horizontal) {
      swipeState.deltaX = deltaX;
      const clamped = Math.min(0, deltaX);
      swipeState.element.style.transform = `translateX(${clamped}px)`;
      swipeState.element.style.opacity = String(Math.max(0.3, 1 + clamped / 200));
    }
  },
  { passive: true }
);

taskList.addEventListener("touchend", () => {
  if (!swipeState) return;

  const { element, deltaX, id } = swipeState;
  swipeState = null;

  element.style.transition = "";
  element.style.transform = "";
  element.style.opacity = "";

  if (deltaX < SWIPE_CLEAR_THRESHOLD) {
    clearTask(id);
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

exportListButton.addEventListener("click", exportList);

openArchiveButton.addEventListener("click", openArchive);
closeArchiveButton.addEventListener("click", closeArchive);

archiveModal.addEventListener("click", (event) => {
  if (event.target === archiveModal) closeArchive();
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !archiveModal.classList.contains("hidden")) {
    closeArchive();
  }
});

archiveList.addEventListener("click", (event) => {
  const restoreButton = event.target.closest(".restore-button");
  if (!restoreButton) return;

  const item = restoreButton.closest(".archive-item");
  const tasksRef = currentTasksRef();
  if (!item || !tasksRef) return;

  restoreCloudTask(tasksRef, item.dataset.id);
});

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
  closeArchive();

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

  newAssigneePicker.classList.toggle("hidden", currentScope !== "company");

  updateEmailAuthVisibility();
  subscribeToCurrentList();
  subscribeToAssignedTasks();
  subscribeToUserProfile();
});

dailyNotificationsToggle.addEventListener("change", () => {
  if (!currentUser) return;
  setDailyNotifications(currentUser.uid, dailyNotificationsToggle.checked);
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

emailForgotPasswordButton.addEventListener("click", async () => {
  const email = emailAuthEmailInput.value.trim();

  if (!email) {
    setEmailAuthStatus("Enter your email address first.");
    return;
  }

  try {
    setEmailAuthStatus("Sending reset email…");
    await resetPassword(email);
    setEmailAuthStatus(`Check ${email} for a password reset link.`);
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
