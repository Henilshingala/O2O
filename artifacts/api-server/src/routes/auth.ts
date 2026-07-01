import { Router } from "express";
import rateLimit from "express-rate-limit";
import { db, users, loginHistory } from "@workspace/db";
import { passwordResetOtps, refreshTokens } from "@workspace/db/schema";
import { eq, and, isNull, gt } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { sendEmail } from "../lib/delivery";
import { hashPassword, verifyPassword } from "../lib/crypto";
import {
  issueTokens,
  hashOtp,
  verifyOtpHash,
  verifyRefreshToken,
  verifyLegacyTokenHash,
  hashRefreshToken,
} from "../lib/tokens";
import {
  validateBody,
  signupSchema,
  loginSchema,
  refreshSchema,
  sendOtpSchema,
  verifyOtpSchema,
  resetPasswordSchema,
} from "../lib/validation";

const router = Router();

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: "Too many OTP requests. Try again later." },
});

const genId = (prefix: string) => `${prefix}_${Date.now()}`;

async function persistRefreshToken(userId: string, refreshTokenHash: string, expiresAt: Date) {
  await db.insert(refreshTokens).values({
    id: genId("rt"),
    userId,
    tokenHash: refreshTokenHash,
    expiresAt,
  });
}

async function issueAuthResponse(userId: string, userWithoutPassword: Record<string, unknown>) {
  const { accessToken, refreshToken, refreshTokenHash, refreshExpiresAt } = issueTokens(userId);
  await persistRefreshToken(userId, refreshTokenHash, refreshExpiresAt);
  return { token: accessToken, refreshToken, user: userWithoutPassword };
}

async function recordLogin(userId: string, req: { ip?: string; headers: Record<string, unknown> }) {
  try {
    await db.insert(loginHistory).values({
      id: genId("login"),
      userId,
      ipAddress: (req.headers["x-forwarded-for"] as string) || req.ip || "unknown",
      device: (req.headers["user-agent"] as string) || "unknown",
    });
  } catch {
    // non-fatal
  }
}

async function findRefreshTokenRecord(refreshToken: string) {
  const tokenHash = hashRefreshToken(refreshToken);
  const byHash = await db
    .select()
    .from(refreshTokens)
    .where(
      and(
        eq(refreshTokens.tokenHash, tokenHash),
        isNull(refreshTokens.revokedAt),
        gt(refreshTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (byHash[0]) return byHash[0];

  // Legacy scrypt-hashed tokens (pre-migration)
  const activeTokens = await db
    .select()
    .from(refreshTokens)
    .where(and(isNull(refreshTokens.revokedAt), gt(refreshTokens.expiresAt, new Date())));

  for (const t of activeTokens) {
    if (t.tokenHash.includes(":") && (await verifyLegacyTokenHash(refreshToken, t.tokenHash))) {
      return t;
    }
  }
  return null;
}

router.post("/signup", validateBody(signupSchema), async (req, res) => {
  try {
    const { username, fullName, email, mobile, city, role, password } = req.body;

    const existingUser = await db.select().from(users).where(eq(users.username, username)).limit(1);
    if (existingUser.length > 0) {
      return res.status(409).json({ error: "Username already exists" });
    }

    const existingEmail = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existingEmail.length > 0) {
      return res.status(409).json({ error: "Email already exists" });
    }

    const existingMobile = await db.select().from(users).where(eq(users.mobile, mobile)).limit(1);
    if (existingMobile.length > 0) {
      return res.status(409).json({ error: "Mobile number already exists" });
    }

    const id = genId("user");
    const hashedPassword = await hashPassword(password);

    await db.transaction(async (tx) => {
      await tx.insert(users).values({
        id,
        username,
        fullName,
        email,
        mobile,
        city,
        role: role || "buyer",
        password: hashedPassword,
      });
    });

    const user = { id, username, fullName, email, mobile, city, role: role || "buyer" };
    const auth = await issueAuthResponse(id, user);
    return res.json(auth);
  } catch (error: unknown) {
    req.log.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/login", validateBody(loginSchema), async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    const user = result[0];

    if (!user || !(await verifyPassword(password, user.password))) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    if (user.isBanned) {
      return res.status(403).json({ error: "Account is banned" });
    }

    await recordLogin(user.id, req);

    const { password: _, ...userWithoutPassword } = user;
    const auth = await issueAuthResponse(user.id, userWithoutPassword);
    return res.json(auth);
  } catch (error: unknown) {
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
  } catch (error: unknown) {
    req.log.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/refresh", validateBody(refreshSchema), async (req, res) => {
  try {
    const { refreshToken } = req.body;

    const match = await findRefreshTokenRecord(refreshToken);
    if (!match) return res.status(401).json({ error: "Invalid refresh token" });

    await db.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.id, match.id));

    const userResult = await db.select().from(users).where(eq(users.id, match.userId)).limit(1);
    const user = userResult[0];
    if (!user) return res.status(401).json({ error: "User not found" });

    const { password: _, ...userWithoutPassword } = user;
    const auth = await issueAuthResponse(user.id, userWithoutPassword);
    return res.json(auth);
  } catch (error: unknown) {
    req.log.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/logout", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      const match = await findRefreshTokenRecord(refreshToken);
      if (match && match.userId === req.user!.userId) {
        await db.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.id, match.id));
      }
    } else {
      await db.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.userId, req.user!.userId));
    }
    return res.json({ success: true });
  } catch (error: unknown) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/send-otp", otpLimiter, validateBody(sendOtpSchema), async (req, res) => {
  const { email } = req.body;

  const userResult = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!userResult.length) {
    return res.json({ success: true });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpHash = await hashOtp(otp);
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

router.post("/verify-otp", otpLimiter, validateBody(verifyOtpSchema), async (req, res) => {
  const { email, otp } = req.body;

  const rows = await db.select().from(passwordResetOtps).where(eq(passwordResetOtps.email, email)).limit(1);
  const record = rows[0];
  if (!record || record.expiresAt < new Date() || !(await verifyOtpHash(otp, record.otpHash))) {
    return res.status(400).json({ error: "Invalid or expired OTP" });
  }

  await db.update(passwordResetOtps).set({ verifiedAt: new Date() }).where(eq(passwordResetOtps.email, email));
  return res.json({ success: true });
});

router.post("/reset-password", otpLimiter, validateBody(resetPasswordSchema), async (req, res) => {
  const { email, password } = req.body;

  const otpRows = await db.select().from(passwordResetOtps).where(eq(passwordResetOtps.email, email)).limit(1);
  const otpRecord = otpRows[0];
  if (!otpRecord?.verifiedAt || otpRecord.expiresAt < new Date()) {
    return res.status(400).json({ error: "OTP verification required before reset" });
  }

  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!result.length) return res.status(404).json({ error: "User not found" });

  const hashedPassword = await hashPassword(password);
  await db.transaction(async (tx) => {
    await tx.update(users).set({ password: hashedPassword }).where(eq(users.email, email));
    await tx.delete(passwordResetOtps).where(eq(passwordResetOtps.email, email));
    await tx.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.userId, result[0]!.id));
  });
  return res.json({ success: true });
});

export default router;
