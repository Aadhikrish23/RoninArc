/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useState,
  type ReactNode,
  useCallback,
  useEffect,
} from "react";
import type { Message, ClarificationRequest } from "../types/conversation";
import aiApi from "../api/aiApi";
import { useAuth } from "../../auth/context/AuthContext";

interface AIContextType {
  messages: Message[];
  isTyping: boolean;
  sendMessage: (text: string) => Promise<void>;
  clearConversation: () => void;
  retry: (failedMessageId: string) => Promise<void>;
}

const AIContext = createContext<AIContextType | undefined>(undefined);

export function AIProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const { user } = useAuth();
  const storageKey = user?.name ? `roninarc_ai_messages_${user.name}` : "";

  // Load conversation from localStorage on mount or when user changes
  useEffect(() => {
    if (storageKey) {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        try {
          interface StoredMessage {
            id: string;
            sender: "user" | "assistant";
            text: string;
            timestamp: string;
            status?: "sending" | "sent" | "error";
            clarificationRequest?: ClarificationRequest | null;
            metrics?: {
              overallMs: number;
              layers: Record<string, number>;
            };
            assistantStatus?: string;
          }
          const parsed = JSON.parse(stored);
          // Convert stored ISO string timestamps back to Date objects
          const messagesWithDates = (parsed as StoredMessage[]).map((m) => ({
            ...m,
            timestamp: new Date(m.timestamp),
          }));
          setMessages(messagesWithDates);
        } catch (e) {
          console.error("[AI Context] Failed to parse stored messages:", e);
        }
      } else {
        setMessages([]);
      }
    } else {
      setMessages([]);
    }
  }, [storageKey]);

  // Save conversation to localStorage when messages change
  useEffect(() => {
    if (storageKey && messages.length > 0) {
      localStorage.setItem(storageKey, JSON.stringify(messages));
    } else if (storageKey && messages.length === 0) {
      localStorage.removeItem(storageKey);
    }
  }, [messages, storageKey]);

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
        metrics: response.metrics || undefined,
        assistantStatus: response.status || (response.success ? "SUCCESS" : "FAILED"),
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

  const retry = useCallback(async (failedMessageId: string) => {
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === failedMessageId);
      if (idx === -1) return prev;
      const userMsgIdx = idx - 1;
      if (userMsgIdx >= 0 && prev[userMsgIdx].sender === "user") {
        const userText = prev[userMsgIdx].text;
        const cleaned = prev.filter((m) => m.id !== failedMessageId);
        setTimeout(() => {
          sendMessage(userText);
        }, 0);
        return cleaned;
      }
      return prev;
    });
  }, [sendMessage]);

  return (
    <AIContext.Provider
      value={{
        messages,
        isTyping,
        sendMessage,
        clearConversation,
        retry,
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
