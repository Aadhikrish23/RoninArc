import axiosInstance from "../../../shared/api/axiosInstance";
import type { ConversationTurn, ClarificationRequest } from "../types/conversation";
import { canLaunchGames } from "../../../shared/utils/runtime";

/** Work the backend hands back because only this app can do it. */
export interface ClientAction {
  type: "launch_game";
  gameId: string;
  title: string;
}

export interface ChatResponse {
  success: boolean;
  message: string;
  status?: string;
  turns?: ConversationTurn[];
  clarificationRequest?: ClarificationRequest | null;
  clientActions?: ClientAction[];
  metrics?: {
    overallMs: number;
    layers: Record<string, number>;
  };
}

export const aiApi = {
  sendMessage: async (message: string): Promise<ChatResponse> => {
    const response = await axiosInstance.post<ChatResponse>("/ai/chat", {
      message,
      // Lets the assistant answer "launch X" honestly: hand it to the desktop app, or explain it can't from the web.
      client: { canLaunchGames: canLaunchGames() },
    });
    return response.data;
  },
};

export default aiApi;
