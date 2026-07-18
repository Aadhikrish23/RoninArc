/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useState,
  type ReactNode,
  useCallback,
} from "react";
import type { Message } from "../types/conversation";
import aiApi from "../api/aiApi";

interface AIContextType {
  messages: Message[];
  isTyping: boolean;
  sendMessage: (text: string) => Promise<void>;
  clearConversation: () => void;
}

const AIContext = createContext<AIContextType | undefined>(undefined);

export function AIProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;

    // Create user message
    const userMessage: Message = {
      id: crypto.randomUUID(),
      sender: "user",
      text: text,
      timestamp: new Date(),
      status: "sending",
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsTyping(true);

    try {
      const response = await aiApi.sendMessage(text);

      // Update user message status to sent
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === userMessage.id ? { ...msg, status: "sent" } : msg
        )
      );

      // Create assistant message
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        sender: "assistant",
        text: response.message || "No response received.",
        timestamp: new Date(),
        status: "sent",
        clarificationRequest: response.clarificationRequest || null,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("[AI Context] Error sending message:", error);

      // Update user message status to error
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === userMessage.id ? { ...msg, status: "error" } : msg
        )
      );

      const errorMessage: Message = {
        id: crypto.randomUUID(),
        sender: "assistant",
        text: "Sorry, I encountered an error. Please check your connection and try again.",
        timestamp: new Date(),
        status: "error",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  }, []);

  const clearConversation = useCallback(() => {
    setMessages([]);
  }, []);

  return (
    <AIContext.Provider
      value={{
        messages,
        isTyping,
        sendMessage,
        clearConversation,
      }}
    >
      {children}
    </AIContext.Provider>
  );
}

export function useAI() {
  const context = useContext(AIContext);
  if (!context) {
    throw new Error("useAI must be used inside AIProvider");
  }
  return context;
}
