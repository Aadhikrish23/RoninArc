import { Router } from "express";
import { aiController } from "./aiController";
import authenticate from "../auth/authMiddleware";

const router = Router();

router.post("/chat", authenticate, aiController.chat.bind(aiController));

export default router;
