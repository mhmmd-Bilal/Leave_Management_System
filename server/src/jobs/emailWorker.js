import env from "../config/env.js";
import { processOutbox } from "../services/emailService.js";

let timer;
let running = false;

export function startEmailWorker() {
  if (timer) return;
  timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await processOutbox();
    } catch (err) {
      console.error("Email worker error:", err.message);
    } finally {
      running = false;
    }
  }, env.email.intervalMs);
  timer.unref();
}

export function stopEmailWorker() {
  if (timer) clearInterval(timer);
  timer = undefined;
}
