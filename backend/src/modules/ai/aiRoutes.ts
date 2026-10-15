import { Router } from "express";
import { aiController, resetConversation } from "./aiController";
import authenticate from "../auth/authMiddleware";

const router = Router();

router.post("/chat", authenticate, aiController.chat.bind(aiController));
router.post("/reset", authenticate, resetConversation);

export default router;
