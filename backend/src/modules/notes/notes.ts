import express from "express";

import authMiddleware from "../auth/authMiddleware";

import noteController from "./noteController";

const noteRouter = express.Router();

noteRouter.use(authMiddleware);

noteRouter.get("/:gameId", noteController.getNotesForGame);

noteRouter.post("/:gameId", noteController.createNote);

noteRouter.patch("/:noteId", noteController.updateNote);

noteRouter.delete("/:noteId", noteController.deleteNote);

export default noteRouter;
