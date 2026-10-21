import mongoose from "mongoose";
import env from "./env.js";

/**
 * Connects to MongoDB. Throws on failure (the original version swallowed the error and kept
 * the server running without a database, which hides configuration problems).
 */
const connectDb = async (uri = env.mongoUrl, options = {}) => {
  if (!uri) throw new Error("MONGO_URL is not set");
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000, ...options });
  console.log("Database Connected");
  return mongoose.connection;
};

export const disconnectDb = () => mongoose.disconnect();

/**
 * Leave approval, cancellation and balance adjustments use multi-document transactions, which
 * MongoDB only supports on replica sets / sharded clusters (Atlas is a replica set).
 */
export async function assertTransactionSupport() {
  const info = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!info.setName && info.msg !== "isdbgrid") {
    throw new Error(
      "MongoDB is running as a standalone server. Transactions require a replica set. " +
        "See README -> 'MongoDB setup' (run mongod with --replSet rs0 and execute rs.initiate(), or use MongoDB Atlas)."
    );
  }
}

export default connectDb;
