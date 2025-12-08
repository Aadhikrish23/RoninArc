import express from "express";
import rawgController from "../controllers/rawgController";
import authMiddleware from "../middleware/authMiddleware";


const rawgRouter = express.Router();

rawgRouter.use(authMiddleware);
console.log("inside the rwag router");
rawgRouter.get("/search", rawgController.searchgame);
rawgRouter.get("/:rawgId", rawgController.getGameDetails);




export default rawgRouter;
