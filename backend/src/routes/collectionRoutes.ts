import express from "express";

import authMiddleware from "../middleware/authMiddleware";

import {
  createCollection,
  getCollections,
  getCollection,
  addGameToCollection,
  removeGameFromCollection,
  deleteCollection,
} from "../controllers/collectionController";

const collectionRouter = express.Router();

collectionRouter.use(authMiddleware);

collectionRouter.post("/", createCollection);

collectionRouter.get("/", getCollections);

collectionRouter.get("/:collectionId", getCollection);

collectionRouter.post("/:collectionId/games", addGameToCollection);

collectionRouter.delete("/:collectionId/games/:gameId", removeGameFromCollection);

collectionRouter.delete("/:collectionId", deleteCollection);

export default collectionRouter;
