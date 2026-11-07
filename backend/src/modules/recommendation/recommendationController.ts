import type { Request, Response, NextFunction } from "express";
import AppError from "../../shared/errors/AppError";
import recommendationService, { RecommendationType } from "./recommendationService";

const TYPES: RecommendationType[] = ["all", "backlog", "discover"];
const MAX_LIMIT = 20;
const validId = (id: unknown) => Number.isInteger(id) && (id as number) > 0;

const getRecommendations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const type = (req.query.type as string | undefined) ?? "all";
    if (!TYPES.includes(type as RecommendationType)) {
      return next(new AppError(`type must be one of: ${TYPES.join(", ")}`, 400));
    }

    const rawLimit = req.query.limit as string | undefined;
    const limit = rawLimit === undefined ? 6 : Number(rawLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
      return next(new AppError(`limit must be a whole number from 1 to ${MAX_LIMIT}`, 400));
    }

    const query = typeof req.query.q === "string" ? req.query.q.slice(0, 200) : undefined;

    const data = await recommendationService.getRecommendations(req.user.id, {
      type: type as RecommendationType,
      limit,
      query,
    });
    return res.status(200).json({ Status: "Success", Data: data });
  } catch (error) {
    next(error);
  }
};

const dismiss = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rawgId, igdbId, title } = req.body ?? {};
    const given = [rawgId, igdbId].filter((id) => id !== undefined);
    if (given.length === 0 || !given.every(validId)) {
      return next(new AppError("A valid rawgId or igdbId is required", 400));
    }
    if (title !== undefined && typeof title !== "string") {
      return next(new AppError("title must be text", 400));
    }
    await recommendationService.dismiss(req.user.id, { rawgId, igdbId }, title);
    return res.status(200).json({ Status: "Success", Message: "Recommendation dismissed" });
  } catch (error) {
    next(error);
  }
};

const restore = (idField: "rawgId" | "igdbId") => async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params[idField]);
    if (!validId(id)) {
      return next(new AppError(`A valid ${idField} is required`, 400));
    }
    const removed = await recommendationService.undoDismiss(req.user.id, { [idField]: id });
    if (!removed) {
      return next(new AppError("That game wasn't dismissed", 404));
    }
    return res.status(200).json({ Status: "Success", Message: "Recommendation restored" });
  } catch (error) {
    next(error);
  }
};

export default { getRecommendations, dismiss, undoDismiss: restore("rawgId"), undoDismissIgdb: restore("igdbId") };
