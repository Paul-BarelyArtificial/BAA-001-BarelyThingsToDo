const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret, defineString } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

admin.initializeApp();

const RESEND_API_KEY = defineSecret("RESEND_API_KEY");

// barelyartificial.app is already verified in Resend. Override by creating
// functions/.env (gitignored) with FROM_EMAIL=... if this ever needs to
// change. See docs/HOSTING.md.
const FROM_EMAIL = defineString("FROM_EMAIL", {
  default: "Barely Things To Do <todo@barelyartificial.app>"
});

const COMPANY_EMAIL_DOMAIN = "barelyartificial.com";
const COMPANY_ID = "barely-artificial";

// Mirrors js/app.js's getNoteLog()/latestNote() - kept in sync by hand since
// this runs in a separate Node environment (Cloud Functions), not the browser.
function latestNote(task) {
  if (Array.isArray(task.noteLog) && task.noteLog.length > 0) {
    return task.noteLog[task.noteLog.length - 1].text;
  }
  if (task.notes) return task.notes; // pre-audit-trail legacy note
  return "";
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderTaskListHtml(taskList) {
  if (taskList.length === 0) return "<p>Nothing on this list.</p>";

  const items = taskList
    .map((task) => {
      const note = latestNote(task);
      const noteHtml = note ? ` — ${escapeHtml(note)}` : "";
      return `<li><strong>${escapeHtml(task.title)}</strong>${noteHtml}</li>`;
    })
    .join("");

  return `<ol>${items}</ol>`;
}

// Mirrors js/app.js's notifyEnabled() - defaults to true (included) so
// tasks created before this field existed keep the original "daily email
// includes everything" behaviour; only an explicit false excludes one.
function notifyEnabled(task) {
  return task.notifyMe !== false;
}

function sortByOrder(docs) {
  return docs
    .map((document) => document.data())
    .filter((task) => !task.archivedAt && notifyEnabled(task))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

async function sendEmail(apiKey, to, subject, html) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ from: FROM_EMAIL.value(), to, subject, html })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend API error ${response.status}: ${body}`);
  }
}

async function buildAndSendFor(db, apiKey, profileDoc) {
  const uid = profileDoc.id;

  let userRecord;
  try {
    userRecord = await admin.auth().getUser(uid);
  } catch (error) {
    logger.error(`No auth user for ${uid}, skipping`, error);
    return;
  }

  const email = userRecord.email;
  if (!email) return;

  const personalTasksSnapshot = await db
    .collection("users")
    .doc(uid)
    .collection("tasks")
    .get();
  const personalTasks = sortByOrder(personalTasksSnapshot.docs);

  const isCompanyMember =
    userRecord.emailVerified && email.toLowerCase().endsWith(`@${COMPANY_EMAIL_DOMAIN}`);

  let assignedTasks = [];
  if (isCompanyMember) {
    const assignedSnapshot = await db
      .collection("companies")
      .doc(COMPANY_ID)
      .collection("tasks")
      .where("assignedTo", "==", email.toLowerCase())
      .get();
    assignedTasks = sortByOrder(assignedSnapshot.docs);
  }

  if (personalTasks.length === 0 && assignedTasks.length === 0) return;

  const dateLabel = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  const html = `
    <h1>Barely Things To Do — ${escapeHtml(dateLabel)}</h1>
    <h2>My List</h2>
    ${renderTaskListHtml(personalTasks)}
    ${
      isCompanyMember
        ? `<h2>Assigned to you (Company List)</h2>${renderTaskListHtml(assignedTasks)}`
        : ""
    }
  `;

  try {
    await sendEmail(apiKey, email, "Your things to do today", html);
    logger.info(`Sent daily notification to ${email}`);
  } catch (error) {
    logger.error(`Failed to send daily notification to ${email}`, error);
  }
}

// Schedule/timezone confirmed with Paul: 8am Europe/London.
exports.sendDailyNotifications = onSchedule(
  {
    schedule: "0 8 * * *",
    timeZone: "Europe/London",
    secrets: [RESEND_API_KEY]
  },
  async () => {
    const db = admin.firestore();
    const apiKey = RESEND_API_KEY.value();

    const profilesSnapshot = await db
      .collection("users")
      .where("dailyNotificationsEnabled", "==", true)
      .get();

    if (profilesSnapshot.empty) {
      logger.info("No users have daily notifications enabled - nothing to send.");
      return;
    }

    await Promise.all(
      profilesSnapshot.docs.map((profileDoc) => buildAndSendFor(db, apiKey, profileDoc))
    );
  }
);
