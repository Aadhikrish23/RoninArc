import type { Request, Response, NextFunction } from "express";
import { expandAbbreviation } from "./gameAbbreviations";
import { rankByTitle, titleMatchScore } from "./titleMatch";
import AppError from "../../shared/errors/AppError";
import rawgService from "./rawgService";
import gameLibrarymodel from "../library/LibraryGame";
import { normalizeTitle } from "../providers/shared/matcher/matcher";

const searchgame = async (req: Request, res: Response, next: NextFunction) => {
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
    // Abbreviations players type ("ds3", "rdr 2") are searched by their full title.
    const searchTerm = expandAbbreviation(query) ?? query.trim();
    const owned = userLibrary.filter((g) => {
      const normLocal = g.normalizedTitle || normalizeTitle(g.title);
      return normLocal.includes(normQuery) || titleMatchScore(searchTerm, g.title) >= 60;
    }).map((g) => g.toJSON());

    // 3. Fetch discovery results from RAWG, best title match first (ties keep RAWG's order)
    let ranked = rankByTitle(searchTerm, await rawgService.searchGames(searchTerm, page));
    // Nothing close ("skyrimm", "hifi rush"): RAWG's fuzzy search tolerates typos and spacing.
    if (page === 1 && (ranked[0]?.score ?? 0) < 70) {
      const fuzzy = await rawgService.searchGames(searchTerm, 1, false).catch(() => []);
      const seen = new Set(ranked.map((r: any) => r.item.id));
      ranked = rankByTitle(searchTerm, [...ranked.map((r) => r.item), ...fuzzy.filter((g: any) => !seen.has(g.id))]);
    }
    // Nothing even half-matches ("zxqvplm game" -> "bob's game"): show no results rather than junk.
    if ((ranked[0]?.score ?? 0) < 30) ranked = [];
    // Entries without cover art are usually mods and fan uploads ("Skyrim Stuff"): real games first.
    const rawgResults = ranked
      .map((r: any, index) => ({ item: r.item, index, score: r.score - (r.item.imageURL ? 0 : 15) }))
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map((r) => r.item);

    // 4. Discovery Search: Exclude already owned games using normalized match checks
    const discover = rawgResults.filter((rawgGame: any) => {
      const isOwned = userLibrary.some((libGame: any) => {
        if (libGame.rawgId === rawgGame.id) return true;
        // Both have RAWG ids and they differ: different games, even when the titles
        // normalise the same ("Modern Warfare 2" vs "Modern Warfare II").
        if (libGame.rawgId && rawgGame.id) return false;
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
