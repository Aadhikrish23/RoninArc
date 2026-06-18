import type { Request, Response, NextFunction } from "express";
import AppError from "../../shared/errors/AppError";
import rawgService from "./rawgService";


const searchgame = async (req: Request, res: Response, next: NextFunction) => {
     console.log(">>> RAWG CONTROLLER HIT <<<");
  try {
    const query = req.query.query as string;
    const pageRaw = req.query.page as string | undefined;


    if (!query || typeof query !== "string" || query.trim() === "") {
      return next(new AppError("Search query is required", 400));
    }


    let page = 1;
    if (pageRaw) {
      const parsed = parseInt(pageRaw, 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        page = parsed;
      }
    }

    const games = await rawgService.searchGames(query.trim(), page);

    return res.status(200).json({
      Status: "Success",
      Data: games,
    });
  } catch (error) {
    next(error);
  }
};

const getGameDetails = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const rawgId = req.params.rawgId;

    if (!rawgId || rawgId.trim() === "") {
      return next(new AppError("RAWG game id is required", 400));
    }

    const game = await rawgService.getGameDetails(rawgId);

    if (!game) {
      return next(new AppError("Game not found", 404));
    }

    return res.status(200).json({
      Status: "Success",
      Data: game,
    });
  } catch (error) {
    next(error);
  }
};

export default {
  searchgame,
  getGameDetails,
};
