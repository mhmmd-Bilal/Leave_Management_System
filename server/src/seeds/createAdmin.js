// Usage: SEED_ADMIN_EMAIL=... SEED_ADMIN_PASSWORD=... npm run create-admin
import connectDb, { disconnectDb } from "../config/db.js";
import { bootstrapAdmin } from "./bootstrapAdmin.js";

try {
  await connectDb();
  const { created, user } = await bootstrapAdmin({
    name: process.env.SEED_ADMIN_NAME,
    email: process.env.SEED_ADMIN_EMAIL,
    password: process.env.SEED_ADMIN_PASSWORD,
  });
  console.log(created ? `Admin created: ${user.email}` : `Admin already exists: ${user.email}`);
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await disconnectDb();
}
