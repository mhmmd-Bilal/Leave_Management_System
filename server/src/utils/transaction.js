import mongoose from "mongoose";

/**
 * Runs `fn(session)` inside a MongoDB transaction. Mongoose retries the callback automatically on
 * TransientTransactionError (e.g. a write conflict with a concurrent approval), so `fn` must only
 * use the supplied session for writes and must not have side effects outside the database.
 */
export const runInTransaction = (fn) => mongoose.connection.transaction(fn);
