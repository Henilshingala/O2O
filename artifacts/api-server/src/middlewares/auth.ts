import { type Request, type Response, type NextFunction } from "express";
import { verifyAccessToken } from "../lib/tokens";

export interface AuthRequest extends Request {
  user?: { userId: string };
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid authorization header" });
  }

  const token = authHeader.split(" ")[1];
  const payload = verifyAccessToken(token);
  if (!payload) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
  req.user = payload;
  return next();
}
