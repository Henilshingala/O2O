import jwt from "jsonwebtoken";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

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

export function hashToken(token: string): string {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(token, salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
}

export function verifyTokenHash(token: string, hash: string): boolean {
  const [salt, key] = hash.split(":");
  if (!salt || !key) return false;
  const keyBuffer = Buffer.from(key, "hex");
  const derivedKey = scryptSync(token, salt, 64);
  return timingSafeEqual(keyBuffer, derivedKey);
}

export function hashOtp(otp: string): string {
  return hashToken(otp);
}

export function verifyOtpHash(otp: string, hash: string): boolean {
  return verifyTokenHash(otp, hash);
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
  const refreshTokenHash = hashToken(refreshToken);
  const refreshExpiresAt = getRefreshExpiry();
  return { accessToken, refreshToken, refreshTokenHash, refreshExpiresAt };
}
