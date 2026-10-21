import env from "../config/env.js";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const SUBJECTS = {
  account_approved: "Your account has been approved",
  account_rejected: "Your registration was not approved",
  leave_approved: "Your leave request was approved",
  leave_rejected: "Your leave request was rejected",
  balance_adjusted: "Your leave balance was adjusted",
};

/** Renders a reusable email (subject + text + html) for a notification type. */
export function renderEmail(type, { name, message }) {
  const subject = SUBJECTS[type] || "Leave Management notification";
  const text = `Hello ${name},\n\n${message}\n\n- Leave Management System`;
  const html =
    `<div style="font-family:Arial,sans-serif;font-size:14px;color:#222">` +
    `<p>Hello ${esc(name)},</p><p>${esc(message)}</p>` +
    `<p style="color:#777">- Leave Management System</p></div>`;
  return { subject: `[${env.isProd ? "LMS" : "LMS dev"}] ${subject}`, text, html };
}
