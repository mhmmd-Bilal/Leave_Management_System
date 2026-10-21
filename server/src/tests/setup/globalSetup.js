// Starts ONE in-memory MongoDB replica set (transactions need it) and shares its URI with the tests.
// Set TEST_MONGO_URL to use your own replica set instead. Each test file gets its own throw-away
// database, so development data is never touched.
import { MongoMemoryReplSet } from "mongodb-memory-server";

let repl;

export async function setup({ provide }) {
  if (process.env.TEST_MONGO_URL) {
    provide("mongoUri", process.env.TEST_MONGO_URL);
    return;
  }
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  provide("mongoUri", repl.getUri());
}

export async function teardown() {
  if (repl) await repl.stop();
}
