import express from "express";
import igdbController from "./igdbController";
import authMiddleware from "../auth/authMiddleware";


const igdbRouter = express.Router();

igdbRouter.use(authMiddleware);
igdbRouter.get("/search", igdbController.searchgame);
igdbRouter.get("/:igdbId", igdbController.getGameDetails);




export default igdbRouter;
