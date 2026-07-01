import { Router } from "express";
import rateLimit from "express-rate-limit";
import { db, users } from "@workspace/db";
import { passwordResetOtps, refreshTokens } from "@workspace/db/schema";
import { eq, and, isNull, gt } from "drizzle-orm";
import { scryptSync, randomBytes, timingSafeEqual } from "crypto";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { sendEmail } from "../lib/delivery";
import {
  issueTokens,
  hashOtp,
  verifyOtpHash,
  verifyTokenHash,
  hashToken,
} from "../lib/tokens";

const router = Router();

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: "Too many OTP requests. Try again later." },
});

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
}

function verifyPassword(password: string, hash: string): boolean {
  const [salt, key] = hash.split(":");
  if (!salt || !key) return false;
  const keyBuffer = Buffer.from(key, "hex");
  const derivedKey = scryptSync(password, salt, 64);
  return timingSafeEqual(keyBuffer, derivedKey);
}

const genId = (prefix: string) => `${prefix}_${Date.now()}`;

async function persistRefreshToken(userId: string, refreshToken: string, refreshTokenHash: string, expiresAt: Date) {
  await db.insert(refreshTokens).values({
    id: genId("rt"),
    userId,
    tokenHash: refreshTokenHash,
    expiresAt,
  });
  return refreshToken;
}

async function issueAuthResponse(userId: string, userWithoutPassword: Record<string, unknown>) {
  const { accessToken, refreshToken, refreshTokenHash, refreshExpiresAt } = issueTokens(userId);
  await persistRefreshToken(userId, refreshToken, refreshTokenHash, refreshExpiresAt);
  return { token: accessToken, refreshToken, user: userWithoutPassword };
}

router.post("/signup", async (req, res) => {
  try {
    const { username, fullName, email, mobile, city, role, password } = req.body;
    if (!username || !password || !email || !mobile || !fullName || !city) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long" });
    }

    const existingUser = await db.select().from(users).where(eq(users.username, username)).limit(1);
    if (existingUser.length > 0) {
      return res.status(400).json({ error: "Username already exists" });
    }

    const existingEmail = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existingEmail.length > 0) {
      return res.status(400).json({ error: "Email already exists" });
    }

    const existingMobile = await db.select().from(users).where(eq(users.mobile, mobile)).limit(1);
    if (existingMobile.length > 0) {
      return res.status(400).json({ error: "Mobile number already exists" });
    }

    const id = genId("user");
    const hashedPassword = hashPassword(password);

    await db.insert(users).values({
      id,
      username,
      fullName,
      email,
      mobile,
      city,
      role: role || "buyer",
      password: hashedPassword,
    });

    const user = { id, username, fullName, email, mobile, city, role: role || "buyer" };
    const auth = await issueAuthResponse(id, user);
    return res.json(auth);
  } catch (error: any) {
    req.log.error(error);
    return res.status(500).json({ error: "Internal server error", details: error.message });
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

    const { password: _, ...userWithoutPassword } = user;
    const auth = await issueAuthResponse(user.id, userWithoutPassword);
    return res.json(auth);
  } catch (error: any) {
    req.log.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

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

router.post("/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: "refreshToken required" });

    const allTokens = await db
      .select()
      .from(refreshTokens)
      .where(and(isNull(refreshTokens.revokedAt), gt(refreshTokens.expiresAt, new Date())));

    const match = allTokens.find((t) => verifyTokenHash(refreshToken, t.tokenHash));
    if (!match) return res.status(401).json({ error: "Invalid refresh token" });

    await db.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.id, match.id));

    const userResult = await db.select().from(users).where(eq(users.id, match.userId)).limit(1);
    const user = userResult[0];
    if (!user) return res.status(401).json({ error: "User not found" });

    const { password: _, ...userWithoutPassword } = user;
    const auth = await issueAuthResponse(user.id, userWithoutPassword);
    return res.json(auth);
  } catch (error: any) {
    req.log.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/logout", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      const allTokens = await db.select().from(refreshTokens).where(eq(refreshTokens.userId, req.user!.userId));
      const match = allTokens.find((t) => verifyTokenHash(refreshToken, t.tokenHash));
      if (match) {
        await db.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.id, match.id));
      }
    } else {
      await db.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.userId, req.user!.userId));
    }
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/send-otp", otpLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email required" });

  const userResult = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!userResult.length) {
    return res.json({ success: true });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpHash = hashOtp(otp);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await db
    .insert(passwordResetOtps)
    .values({ email, otpHash, expiresAt })
    .onConflictDoUpdate({
      target: passwordResetOtps.email,
      set: { otpHash, expiresAt, verifiedAt: null, createdAt: new Date() },
    });

  await sendEmail(email, "Your O2O OTP Code", `Your verification code is: ${otp}. It expires in 10 minutes.`);

  const isDev = process.env.NODE_ENV !== "production" && !process.env.SMTP_HOST;
  return res.json({ success: true, ...(isDev ? { otp } : {}) });
});

router.post("/verify-otp", otpLimiter, async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ error: "Email and OTP required" });

  const rows = await db.select().from(passwordResetOtps).where(eq(passwordResetOtps.email, email)).limit(1);
  const record = rows[0];
  if (!record || record.expiresAt < new Date() || !verifyOtpHash(otp, record.otpHash)) {
    return res.status(400).json({ error: "Invalid or expired OTP" });
  }

  await db.update(passwordResetOtps).set({ verifiedAt: new Date() }).where(eq(passwordResetOtps.email, email));
  return res.json({ success: true });
});

router.post("/reset-password", otpLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });

  const otpRows = await db.select().from(passwordResetOtps).where(eq(passwordResetOtps.email, email)).limit(1);
  const otpRecord = otpRows[0];
  if (!otpRecord?.verifiedAt || otpRecord.expiresAt < new Date()) {
    return res.status(400).json({ error: "OTP verification required before reset" });
  }

  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!result.length) return res.status(404).json({ error: "User not found" });

  const hashedPassword = hashPassword(password);
  await db.update(users).set({ password: hashedPassword }).where(eq(users.email, email));
  await db.delete(passwordResetOtps).where(eq(passwordResetOtps.email, email));
  return res.json({ success: true });
});

export default router;
