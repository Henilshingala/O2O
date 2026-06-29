import { Router } from "express";
import { db, users } from "@workspace/db";
import { eq } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { scryptSync, randomBytes, timingSafeEqual } from "crypto";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_do_not_use_in_prod";

// Helper for password hashing
function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
}

// Helper for password verification
function verifyPassword(password: string, hash: string): boolean {
  const [salt, key] = hash.split(":");
  if (!salt || !key) return false;
  const keyBuffer = Buffer.from(key, "hex");
  const derivedKey = scryptSync(password, salt, 64);
  return timingSafeEqual(keyBuffer, derivedKey);
}

router.post("/signup", async (req, res) => {
  try {
    const { username, fullName, email, mobile, city, role, password } = req.body;
    
    // Check existing
    const existing = await db.select().from(users).where(eq(users.username, username)).limit(1);
    if (existing.length > 0) {
      return res.status(400).json({ error: "Username already taken" });
    }

    const id = `user_${Date.now()}`;
    const hashedPassword = hashPassword(password);

    await db.insert(users).values({
      id,
      username,
      fullName,
      email,
      mobile,
      city,
      role,
      password: hashedPassword,
    });

    const user = { id, username, fullName, email, mobile, city, role };
    const token = jwt.sign({ userId: id }, JWT_SECRET, { expiresIn: "7d" });

    return res.json({ token, user });
  } catch (error: any) {
    req.log.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    const user = result[0];

    if (!user || !verifyPassword(password, user.password)) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });
    const { password: _, ...userWithoutPassword } = user;

    return res.json({ token, user: userWithoutPassword });
  } catch (error: any) {
    req.log.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

import { requireAuth, type AuthRequest } from "../middlewares/auth";

router.get("/me", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const user = result[0];
    if (!user) return res.status(404).json({ error: "User not found" });

    const { password: _, ...userWithoutPassword } = user;
    return res.json(userWithoutPassword);
  } catch (error: any) {
    req.log.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

import { sendEmail } from "../lib/delivery";
const otps: Record<string, string> = {}; // In-memory for now, could be redis/db

router.post("/send-otp", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email required" });
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otps[email] = otp;
  await sendEmail(email, "Your O2O OTP Code", `Your verification code is: ${otp}`);
  return res.json({ success: true, otp }); // Return otp for dev purposes since no real email sent
});

router.post("/verify-otp", async (req, res) => {
  const { email, otp } = req.body;
  if (otps[email] === otp) {
    return res.json({ success: true });
  }
  return res.status(400).json({ error: "Invalid or expired OTP" });
});

router.post("/reset-password", async (req, res) => {
  const { email, password } = req.body;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!result.length) return res.status(404).json({ error: "User not found" });

  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, 64).toString("hex");
  const hashedPassword = `${salt}:${derivedKey}`;

  await db.update(users).set({ password: hashedPassword }).where(eq(users.email, email));
  delete otps[email];
  return res.json({ success: true });
});

export default router;
