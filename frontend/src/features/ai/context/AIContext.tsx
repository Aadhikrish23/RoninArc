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
import axios from "axios";
import aiApi from "../api/aiApi";
import { useAuth } from "../../auth/context/AuthContext";
import { eventBus } from "../../../shared/events/EventBus";
import { AI_LAUNCH_EVENT } from "../../library/context/LaunchContext";

import type { AISettings } from "../components/AISettingsModal";

interface AIContextType {
  messages: Message[];
  isTyping: boolean;
  sendMessage: (text: string) => Promise<void>;
  clearConversation: () => void;
  retry: (failedMessageId: string) => Promise<void>;
  settings: AISettings;
  updateSettings: (settings: AISettings) => void;
}

const AIContext = createContext<AIContextType | undefined>(undefined);

export function AIProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const { user } = useAuth();
  const storageKey = user?.name ? `roninarc_ai_messages_${user.name}` : "";

  const [settings, setSettings] = useState<AISettings>(() => {
    const stored = localStorage.getItem("roninarc_ai_settings");
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error(e);
      }
    }
    return {
      systemPersona: "default",
      temperature: 0.7,
    };
  });

  const updateSettings = useCallback((newSettings: AISettings) => {
    setSettings(newSettings);
    localStorage.setItem("roninarc_ai_settings", JSON.stringify(newSettings));
  }, []);

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

      // The backend can't start games on this PC; it asks us to (see LaunchProvider).
      for (const action of response.clientActions ?? []) {
        if (action.type === "launch_game") eventBus.publish(AI_LAUNCH_EVENT, { gameId: action.gameId });
      }

      // Publish completion events on the shared EventBus
      // Any change can touch any of these ("put this one in soulslikes" never says "collection").
      if (response.success) {
        eventBus.publish("collection.updated");
        eventBus.publish("review.updated");
        eventBus.publish("notes.updated");
        eventBus.publish("library.updated");
        eventBus.publish("dashboard.updated");
      }
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
        text:
          (axios.isAxiosError(error) && error.response?.data?.message) ||
          "Sorry, I encountered an error. Please check your connection and try again.",
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
    // The assistant also forgets what "it" pointed at; a failed reset only leaves stale context.
    aiApi.reset().catch(() => undefined);
  }, []);

  const retry = useCallback(async (failedMessageId: string) => {
    // sendMessage must run as a side effect *after* setMessages settles, never
    // inside the updater itself: React 18 Strict Mode (dev) invokes updater
    // functions twice to surface exactly this kind of impurity, which was
    // silently sending the retried request twice on every click.
    let userText: string | null = null;
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === failedMessageId);
      if (idx === -1) return prev;
      const userMsgIdx = idx - 1;
      if (userMsgIdx >= 0 && prev[userMsgIdx].sender === "user") {
        userText = prev[userMsgIdx].text;
        // sendMessage posts the text again, so the failed copy goes too (no duplicate bubble).
        const failedUserId = prev[userMsgIdx].id;
        return prev.filter((m) => m.id !== failedMessageId && m.id !== failedUserId);
      }
      return prev;
    });
    if (userText !== null) {
      await sendMessage(userText);
    }
  }, [sendMessage]);

  return (
    <AIContext.Provider
      value={{
        messages,
        isTyping,
        sendMessage,
        clearConversation,
        retry,
        settings,
        updateSettings,
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
