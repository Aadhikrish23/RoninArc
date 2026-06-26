import type { Request, Response, NextFunction } from "express";
import AppError from "../../shared/errors/AppError";
import rawgService from "./rawgService";
import gameLibrarymodel from "../library/LibraryGame";
import { normalizeTitle } from "../providers/shared/matcher/matcher";

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

    // 1. Fetch user's entire local library
    const userLibrary = await gameLibrarymodel.find({ userId: req.user.id });
    const normQuery = normalizeTitle(query.trim());

    // 2. Local Search: Filter local library games by comparing normalized titles
    const owned = userLibrary.filter((g) => {
      const normLocal = g.normalizedTitle || normalizeTitle(g.title);
      return normLocal.includes(normQuery);
    }).map((g) => g.toJSON());

    // 3. Fetch discovery results from RAWG
    const rawgResults = await rawgService.searchGames(query.trim(), page);

    // 4. Discovery Search: Exclude already owned games using normalized match checks
    const discover = rawgResults.filter((rawgGame: any) => {
      const isOwned = userLibrary.some((libGame: any) => {
        if (libGame.rawgId === rawgGame.id) return true;
        const normLibTitle = libGame.normalizedTitle || normalizeTitle(libGame.title);
        const normRawgTitle = normalizeTitle(rawgGame.name);
        if (normLibTitle === normRawgTitle) return true;
        if (libGame.providerTitle && normalizeTitle(libGame.providerTitle) === normRawgTitle) return true;
        return false;
      });
      return !isOwned;
    });

    return res.status(200).json({
      Status: "Success",
      Data: {
        owned,
        discover,
        totalOwned: owned.length,
        totalDiscover: discover.length,
      },
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
