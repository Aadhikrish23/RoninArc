import axiosInstance from "../../../shared/api/axiosInstance";
import type { ConversationTurn, ClarificationRequest } from "../types/conversation";

export interface ChatResponse {
  success: boolean;
  message: string;
  status?: string;
  turns?: ConversationTurn[];
  clarificationRequest?: ClarificationRequest | null;
  metrics?: {
    overallMs: number;
    layers: Record<string, number>;
  };
}

export const aiApi = {
  sendMessage: async (message: string): Promise<ChatResponse> => {
    const response = await axiosInstance.post<ChatResponse>("/ai/chat", {
      message,
    });
    return response.data;
  },
};

export default aiApi;
