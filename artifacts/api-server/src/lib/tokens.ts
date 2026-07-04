import jwt from "jsonwebtoken";
import { randomBytes, createHash, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { scrypt } from "crypto";

const scryptAsync = promisify(scrypt);

const ACCESS_EXPIRY = "15m";
const REFRESH_EXPIRY_DAYS = 7;

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET must be set in production");
    }
    return "dev_fallback_secret_change_in_prod";
  }
  return secret;
}

/** SHA-256 for refresh token lookup (high-entropy tokens; O(1) DB lookup). */
export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function verifyRefreshToken(token: string, storedHash: string): boolean {
  const hash = hashRefreshToken(token);
  try {
    return timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(storedHash, "hex"));
  } catch {
    return false;
  }
}

/** Async scrypt for OTP hashing (never blocks event loop). */
export async function hashOtp(otp: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scryptAsync(otp, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

export async function verifyOtpHash(otp: string, hash: string): Promise<boolean> {
  const [salt, key] = hash.split(":");
  if (!salt || !key) return false;
  const keyBuffer = Buffer.from(key, "hex");
  const derivedKey = (await scryptAsync(otp, salt, 64)) as Buffer;
  return timingSafeEqual(keyBuffer, derivedKey);
}

/** @deprecated Use hashRefreshToken for new refresh tokens. Kept for legacy scrypt hashes. */
export async function verifyLegacyTokenHash(token: string, hash: string): Promise<boolean> {
  const [salt, key] = hash.split(":");
  if (!salt || !key) return false;
  const keyBuffer = Buffer.from(key, "hex");
  const derivedKey = (await scryptAsync(token, salt, 64)) as Buffer;
  return timingSafeEqual(keyBuffer, derivedKey);
}

export function signAccessToken(userId: string): string {
  return jwt.sign({ userId }, getJwtSecret(), { expiresIn: ACCESS_EXPIRY });
}

export function signRefreshToken(): string {
  return randomBytes(48).toString("hex");
}

export function getRefreshExpiry(): Date {
  return new Date(Date.now() + REFRESH_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
}

export function verifyAccessToken(token: string): { userId: string } | null {
  try {
    return jwt.verify(token, getJwtSecret()) as { userId: string };
  } catch {
    return null;
  }
}

export function issueTokens(userId: string) {
  const accessToken = signAccessToken(userId);
  const refreshToken = signRefreshToken();
  const refreshTokenHash = hashRefreshToken(refreshToken);
  const refreshExpiresAt = getRefreshExpiry();
  return { accessToken, refreshToken, refreshTokenHash, refreshExpiresAt };
}
