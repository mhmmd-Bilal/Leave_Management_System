import nodemailer from "nodemailer";
import env from "../config/env.js";
import EmailOutbox from "../models/emailOutboxModel.js";

let transport;
let override;

/** Test hook: inject a fake transport ({ sendMail(msg) }). */
export const setTransportForTests = (t) => {
  override = t;
};

function getTransport() {
  if (override) return override;
  if (!transport) {
    transport = env.smtp.host
      ? nodemailer.createTransport({
          host: env.smtp.host,
          port: env.smtp.port,
          secure: env.smtp.secure,
          auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
        })
      : // Development fallback: no SMTP configured => build the message and log it, send nothing.
        nodemailer.createTransport({ jsonTransport: true });
  }
  return transport;
}

const backoffMs = (attempt) => Math.min(60 * 60 * 1000, 30_000 * 2 ** (attempt - 1));

/**
 * Delivers queued emails. Each row is claimed atomically (pending -> sending) so several worker
 * instances never send the same email twice; failures are retried with exponential backoff.
 */
export async function processOutbox({ batchSize = 20 } = {}) {
  const now = new Date();
  const staleSending = new Date(now.getTime() - 5 * 60 * 1000);
  const candidates = await EmailOutbox.find({
    $or: [
      { status: "pending", nextAttemptAt: { $lte: now } },
      { status: "sending", updatedAt: { $lte: staleSending } },
    ],
  })
    .sort({ createdAt: 1 })
    .limit(batchSize)
    .select("_id status");

  const result = { sent: 0, failed: 0, retried: 0 };
  for (const c of candidates) {
    const mail = await EmailOutbox.findOneAndUpdate(
      { _id: c._id, status: c.status },
      { $set: { status: "sending" }, $inc: { attempts: 1 } },
      { new: true }
    );
    if (!mail) continue; // claimed by another worker
    try {
      const info = await getTransport().sendMail({
        from: env.smtp.from,
        to: mail.to,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      });
      if (!env.smtp.host && !env.isTest && !override) {
        console.log(`[email:dev] (SMTP not configured) to=${mail.to} subject="${mail.subject}"`);
      }
      await EmailOutbox.updateOne(
        { _id: mail._id },
        { $set: { status: "sent", sentAt: new Date() }, $unset: { lastError: "" } }
      );
      result.sent += 1;
      void info;
    } catch (err) {
      const giveUp = mail.attempts >= env.email.maxAttempts;
      await EmailOutbox.updateOne(
        { _id: mail._id },
        {
          $set: {
            status: giveUp ? "failed" : "pending",
            lastError: String(err.message).slice(0, 500),
            nextAttemptAt: new Date(Date.now() + backoffMs(mail.attempts)),
          },
        }
      );
      if (giveUp) result.failed += 1;
      else result.retried += 1;
    }
  }
  return result;
}
