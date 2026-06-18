import express from "express";

import authMiddleware from "../auth/authMiddleware";

import {
  createCollection,
  getCollections,
  getCollection,
  addGameToCollection,
  removeGameFromCollection,
  deleteCollection,
} from "./collectionController";

const collectionRouter = express.Router();

collectionRouter.use(authMiddleware);

collectionRouter.post("/", createCollection);

collectionRouter.get("/", getCollections);

collectionRouter.get("/:collectionId", getCollection);

collectionRouter.post("/:collectionId/games", addGameToCollection);

collectionRouter.delete("/:collectionId/games/:gameId", removeGameFromCollection);

collectionRouter.delete("/:collectionId", deleteCollection);

export default collectionRouter;
