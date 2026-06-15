import express from "express";
import authMiddleware from "../middleware/authMiddleware";
import librarycontroller from "../controllers/librarycontroller";

const library_router = express.Router();

// Get all games
library_router.get("/", authMiddleware, librarycontroller.getLibrary);

// Add a new game
library_router.post("/add", authMiddleware, librarycontroller.addGame);

// Dynamic filter
library_router.get(
  "/filter/search",
  authMiddleware,
  librarycontroller.filterGames,
);

// Get a single game by id
library_router.get("/:gameid", authMiddleware, librarycontroller.getGameById);

// Update a single game by id
library_router.patch("/:gameid", authMiddleware, librarycontroller.updateGame);

// Delete a single game by id
library_router.delete("/:gameid", authMiddleware, librarycontroller.deleteGame);

export default library_router;
