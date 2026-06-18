import libraryServices from "./libraryServices";
import type { Request, Response, NextFunction } from "express";
import AppError from "../../shared/errors/AppError";
import mongoose from "mongoose";

const allowerstatus = ["plan", "playing", "completed", "dropped"];
const allowedSearchParams = ["title", "tags", "status"];

interface updatetype {
  tags?: string[];
  exePath?: string;
  status: string;
}
const addGame = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.id;
    let title = req.body.title;
    let description = req.body.description;
    let tags = req.body.tags;
    let imageURL = req.body.imageURL;
    let exePath = req.body.exePath;
    let status = req.body.status;
    if (typeof title !== "string" || !title || title.trim() === "") {
      return next(new AppError("Title is required", 400));
    }
    if (!Array.isArray(tags)) {
      return next(new AppError("Invalid Tags", 400));
    }
    if (
      (typeof description !== "string" && description !== undefined) ||
      (typeof imageURL !== "string" && imageURL !== undefined) ||
      (typeof exePath !== "string" && exePath !== undefined)
    ) {
      return next(
        new AppError(
          "Invalid inputs: description,imageURL,exePath must be text/string ",
          400
        )
      );
    }

    if (status !== undefined) {
      if (
        typeof status !== "string" ||
        !allowerstatus.includes(status.trim())
      ) {
        return next(new AppError("Invalid status", 400));
      }
    }
    const payload = {
      title: title.trim(),
      description: description !== undefined ? description.trim() : undefined,
      tags: tags,
      imageURL: imageURL !== undefined ? imageURL.trim() : undefined,
      exePath: exePath !== undefined ? exePath.trim() : undefined,
      status: status !== undefined ? status.trim() : "plan",
    };
    const data = await libraryServices.addGameToLibrary(userId, payload);

    return res.status(201).json({ Status: "Success", Data: data });
  } catch (error) {
    next(error);
  }
};

const getLibrary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.id;
    const data = await libraryServices.getUserLibrary(userId);

    return res.status(200).json({ Status: "Success", Data: data });
  } catch (error) {
    next(error);
  }
};

const getGameById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.id;

    const gameid = req.params.gameid;
    if (!mongoose.Types.ObjectId.isValid(gameid)) {
      return next(new AppError("Invalid game id", 400));
    }

    const data = await libraryServices.getGameById(userId, gameid);
    if (!data) {
      return next(new AppError("no value found", 404));
    }
    return res.status(200).json({ Status: "Success", Data: data });
  } catch (error) {
    next(error);
  }
};

const filterGames = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.id;
      const searchparam = req.query.param as string;
    const searchvalue = req.query.value as string;
    if (!searchparam) {
   return next(new AppError("Missing search param", 400));
}
if (!searchvalue) {
   return next(new AppError("Missing search value", 400));
}
    
    if (!allowedSearchParams.includes(searchparam)) {
      return next(new AppError("Invalid Search params", 400));
    }
    if (
      !searchvalue ||
      typeof searchvalue !== "string" ||
      searchvalue.trim() === ""
    ) {
      return next(new AppError("Invalid Search value", 400));
    }
    const data = await libraryServices.getGameFilter(
      userId,
      searchparam,
      searchvalue
    );

    if (!data) {
      return next(new AppError("no value found", 404));
    }
    return res.status(200).json({ Status: "Success", Data: data });
  } catch (error) {
    next(error);
  }
};

const updateGame = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.id;

    let tags = req.body.tags;
    const gameid = req.params.gameid;

    let exePath = req.body.exePath;
    let status = req.body.status;
    if (!mongoose.Types.ObjectId.isValid(gameid)) {
   return next(new AppError("Invalid game id", 400));
}


    if (
      (typeof exePath !== "string" && exePath !== undefined)
    ) {
      return next(
        new AppError(
          "Invalid inputs: exePath must be text/string ",
          400
        )
      );
    }
if (status !== undefined) {
      if (
        typeof status !== "string" ||
        !allowerstatus.includes(status.trim())
      ) {
        return next(new AppError("Invalid status", 400));
      }
    }

    if (tags !== undefined &&!Array.isArray(tags)) {
      return next(new AppError("Invalid Tags", 400));
    }

    let updates = <updatetype>{};
   if (Array.isArray(tags)) {
  updates["tags"] = tags;
}

    if (status) {
      updates["status"] = status.trim();
    }
    if (exePath) {
      updates["exePath"] = exePath.trim();
    }

    const data = await libraryServices.updateGame(userId, gameid, updates);
    if (!data) {
      return next(new AppError("no value found", 404));
    }
    return res.status(200).json({ Status: "Success", Data: data });
  } catch (error) {
    next(error);
  }
};

const deleteGame = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.id;
    const gameid = req.params.gameid;

    if (!gameid || !mongoose.Types.ObjectId.isValid(gameid)) {
      return next(new AppError("invalid game id", 400));
    }
    const data = await libraryServices.deleteGame(userId, gameid);

    if (!data) {
      return next(new AppError("no value found", 404));
    }

    return res.status(200).json({ Status: "Success", Data: data });
  } catch (error) {
    next(error);
  }
};
export default {
  addGame,
  getLibrary,
  getGameById,
  updateGame,
  deleteGame,
  filterGames,
};
