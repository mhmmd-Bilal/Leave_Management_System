import app from "./app.js";
import connectDb, { assertTransactionSupport } from "./config/db.js";
import env, { assertEnv } from "./config/env.js";
import { startEmailWorker } from "./jobs/emailWorker.js";
import { getSettings } from "./services/settingsService.js";

async function main() {
  assertEnv();
  await connectDb();
  await assertTransactionSupport();
  await getSettings(); // make sure the settings singleton exists
  startEmailWorker();
  app.listen(env.port, () => console.log(`Server started on port ${env.port} (${env.nodeEnv})`));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
