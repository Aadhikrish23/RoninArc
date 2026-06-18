import express from "express";
import rawgController from "./rawgController";
import authMiddleware from "../auth/authMiddleware";


const rawgRouter = express.Router();

rawgRouter.use(authMiddleware);
console.log("inside the rwag router");
rawgRouter.get("/search", rawgController.searchgame);
rawgRouter.get("/:rawgId", rawgController.getGameDetails);




export default rawgRouter;
