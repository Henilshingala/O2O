import { db, users } from "@workspace/db";
import { eq } from "drizzle-orm";
import { scryptSync, randomBytes } from "crypto";
import { logger } from "./logger";

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
}

export async function seedSuperAdmin(): Promise<void> {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME;

  if (!email || !password || !name) {
    logger.info("ADMIN_EMAIL/ADMIN_PASSWORD/ADMIN_NAME not set, skipping super admin seed");
    return;
  }

  try {
    // Check if any admin exists
    const existingAdmins = await db.select({ id: users.id })
      .from(users)
      .where(eq(users.role, "admin"))
      .limit(1);

    if (existingAdmins.length > 0) {
      logger.info("Admin user(s) already exist, skipping seed");
      return;
    }

    const id = `admin_${Date.now()}`;
    const hashedPassword = hashPassword(password);

    await db.insert(users).values({
      id,
      username: email.split("@")[0] ?? "admin",
      fullName: name,
      email,
      mobile: "0000000000",
      city: "System",
      role: "admin",
      password: hashedPassword,
      adminRole: "super_admin",
      isBanned: false,
      isVerifiedSeller: false,
    });

    logger.info({ email }, "Super Admin created successfully");
  } catch (error) {
    logger.error({ error }, "Failed to seed super admin");
  }
}
