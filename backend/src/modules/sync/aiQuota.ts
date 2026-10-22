import mongoose from "mongoose";
import type { Request, Response, NextFunction } from "express";
import { DailyUsage } from "./syncModels";

/**
 * In the cloud everyone shares one server and one keygate token, so each person gets their own
 * daily AI allowance here (AI_DAILY_LIMIT_PER_USER, default 150). Over it, the chat answers
 * plainly instead of calling the model.
 */
export async function cloudAiQuota(req: Request, res: Response, next: NextFunction) {
  const userId = (req as any).user?.id;
  if (req.method !== "POST" || !userId || !mongoose.isValidObjectId(userId)) return next();
  const limit = Number(process.env.AI_DAILY_LIMIT_PER_USER || 150);
  const day = new Date().toISOString().slice(0, 10);
  try {
    const row: any = await DailyUsage.findOneAndUpdate(
      { userId, kind: "ai", day },
      { $inc: { count: 1 } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
    if (row.count > limit) {
      return res.status(200).json({
        success: false,
        status: "LIMITED",
        message: "You've used today's AI messages. They reset at midnight UTC (5:30 AM in India) -- everything else in RoninArc keeps working.",
      });
    }
  } catch {
    // Counting failed: don't block the chat over bookkeeping.
  }
  next();
}
