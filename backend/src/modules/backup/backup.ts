import express from "express";

import authMiddleware from "../auth/authMiddleware";

import backupController from "./backupController";

const backupRouter = express.Router();

// Unauthenticated: this is how a fresh install gets its first account --
// there is no local session to authenticate with yet. It authenticates
// against Atlas's own stored password hash instead.
backupRouter.post("/restore", backupController.restoreBackup);

backupRouter.post("/push", authMiddleware, backupController.pushBackup);

export default backupRouter;
