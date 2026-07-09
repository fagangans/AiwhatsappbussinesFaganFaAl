// One-off CLI: reset the admin dashboard password directly in the DB.
// Usage: node reset-admin-password.js <newPassword>
import bcrypt from "bcryptjs";
import {
  dashboardUserExists,
  createDashboardUser,
  updateDashboardPassword,
  getDashboardUser,
} from "./WhatsApp/database/business/db.js";

const newPassword = process.argv[2];
if (!newPassword || newPassword.length < 8) {
  console.error("Usage: node reset-admin-password.js <newPassword (min 8 chars)>");
  process.exit(1);
}

const hash = bcrypt.hashSync(newPassword, 10);

if (!dashboardUserExists()) {
  createDashboardUser("admin", hash, "Administrator", "admin");
  console.log("Admin user 'admin' created with the given password.");
} else if (getDashboardUser("admin")) {
  updateDashboardPassword("admin", hash);
  console.log("Admin user 'admin' password updated.");
} else {
  createDashboardUser("admin", hash, "Administrator", "admin");
  console.log("Admin user 'admin' created with the given password.");
}
