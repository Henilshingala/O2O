import { z } from "zod";
import type { Request, Response, NextFunction } from "express";

export function validateBody<T extends z.ZodType>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(422).json({
        error: "Validation failed",
        details: result.error.flatten().fieldErrors,
      });
    }
    req.body = result.data;
    return next();
  };
}

export function validateQuery<T extends z.ZodType>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return res.status(422).json({
        error: "Validation failed",
        details: result.error.flatten().fieldErrors,
      });
    }
    req.query = result.data as typeof req.query;
    return next();
  };
}

export const signupSchema = z.object({
  username: z.string().min(3).max(50),
  fullName: z.string().min(1).max(100),
  email: z.string().email(),
  mobile: z.string().min(5).max(20),
  city: z.string().min(1).max(100),
  role: z.enum(["buyer", "seller"]).optional(),
  password: z.string().min(6).max(128),
});

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const sendOtpSchema = z.object({
  email: z.string().email(),
});

export const verifyOtpSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
});

export const resetPasswordSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(128),
});

export const friendRequestSchema = z.object({
  contactId: z.string().min(1),
});

export const friendActionSchema = z.object({
  requesterId: z.string().min(1),
});

export const friendRemoveSchema = z.object({
  contactId: z.string().min(1),
});

export const createChannelSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000),
  category: z.string().min(1),
  visibility: z.enum(["public", "private"]),
  image: z.string().optional(),
  logo: z.string().optional(),
});

export const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000),
  price: z.number().int().positive(),
  categoryId: z.string().optional(),
  image: z.string().optional(),
  images: z.array(z.string()).optional(),
  details: z.array(z.object({ name: z.string(), value: z.string() })).optional(),
});

export const createBidSchema = z.object({
  productName: z.string().min(1),
  productImage: z.string().optional(),
  quantity: z.number().int().positive(),
  budget: z.number().int().positive(),
  description: z.string().min(1),
  selectedSellers: z.array(z.string()).optional(),
  allSellers: z.boolean().optional(),
  endTime: z.string().datetime().optional(),
});

export const createReviewSchema = z.object({
  orderId: z.string().min(1),
  sellerId: z.string().min(1),
  productName: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  text: z.string().min(1).max(2000),
});

export const orderStatusSchema = z.object({
  status: z.enum(["pending", "confirmed", "delivered"]),
});

export const winnerSchema = z.object({
  winnerId: z.string().min(1),
  winnerChannelId: z.string().min(1),
});

export const rejectBidSchema = z.object({
  channelId: z.string().min(1),
  reason: z.string().min(1).max(500),
});

export const createChatSchema = z.object({
  myId: z.string().min(1),
  otherId: z.string().min(1),
});

export const sendMessageSchema = z.object({
  text: z.string().max(10000).optional(),
  type: z.enum(["text", "image", "video", "audio", "file", "location", "poll"]).optional(),
  metadata: z.record(z.unknown()).optional(),
  timestamp: z.string().optional(),
});

export const wishlistSchema = z.object({
  productId: z.string().min(1),
});
