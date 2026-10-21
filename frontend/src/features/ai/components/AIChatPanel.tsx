import {
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Icon,
  IconButton,
  Text,
  Tooltip,
  useColorModeValue,
  useDisclosure,
  Wrap,
  WrapItem,
} from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import type { JSX } from "react";
import { FiSettings, FiTrash2, FiX } from "react-icons/fi";
import { IoSparklesOutline } from "react-icons/io5";
import { useAI } from "../context/AIContext";
import { useLibrary } from "../../library/hooks/useLibrary";
import MessageBubbles from "./MessageBubbles";
import TypingIndicator from "./TypingIndicator";
import ChatInput from "./ChatInput";
import AISettingsModal from "./AISettingsModal";

const EXAMPLE_PROMPTS = [
  "What should I play tonight?",
  "What's in my backlog?",
  "Add Hades",
  "I finished Celeste",
  "Rate Hollow Knight 9",
];

interface AIChatPanelProps {
  onClose: () => void;
}

/** The whole assistant conversation, sized to live inside the quick-access modal. */
export default function AIChatPanel({ onClose }: AIChatPanelProps): JSX.Element {
  const { messages, isTyping, sendMessage, clearConversation, retry, settings, updateSettings } = useAI();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // "Add Hades" isn't a useful example when Hades is already in the library.
  const { games } = useLibrary();
  const owns = (title: string) => games.some((g) => g.title.toLowerCase() === title.toLowerCase());
  const prompts = EXAMPLE_PROMPTS.filter((p) => !(p.startsWith("Add ") && owns(p.slice(4))));
  const settingsModal = useDisclosure();
  // Clearing wipes the whole chat, so it takes a second click to confirm.
  const [confirmClear, setConfirmClear] = useState(false);
  useEffect(() => {
    if (!confirmClear) return;
    const id = setTimeout(() => setConfirmClear(false), 4000);
    return () => clearTimeout(id);
  }, [confirmClear]);

  const headerBg = useColorModeValue("white", "gray.900");
  const borderColor = useColorModeValue("gray.200", "gray.700");
  const mutedText = useColorModeValue("gray.500", "gray.400");

  const openedRef = useRef(false);
  useEffect(() => {
    const firstOpen = !openedRef.current;
    const behavior = firstOpen ? "auto" : "smooth";
    openedRef.current = true;
    // Wait a frame so the modal has laid out the messages before scrolling.
    const id = requestAnimationFrame(() => messagesEndRef.current?.scrollIntoView({ behavior, block: "end" }));
    // On open, scroll again once the slide-in animation and long replies have settled
    // (it reopened mid-history otherwise).
    const settle = firstOpen ? setTimeout(() => messagesEndRef.current?.scrollIntoView({ block: "end" }), 350) : undefined;
    return () => {
      cancelAnimationFrame(id);
      if (settle) clearTimeout(settle);
    };
  }, [messages, isTyping]);

  return (
    <Flex direction="column" h="full" overflow="hidden">
      <Flex as="header" align="center" gap={3} px={5} py={3} bg={headerBg} borderBottomWidth="1px" borderColor={borderColor}>
        <Icon as={IoSparklesOutline} w={5} h={5} color="purple.500" />
        <Box flex="1" minW={0}>
          <Heading as="h2" size="sm">
            RoninArc AI Assistant
          </Heading>
          <Text fontSize="xs" color={mutedText}>
            {isTyping ? "Processing..." : `${messages.length} ${messages.length === 1 ? "message" : "messages"}`}
          </Text>
        </Box>
        <HStack spacing={1}>
          <Button
            leftIcon={<FiTrash2 />}
            size="sm"
            colorScheme="red"
            onClick={() => {
              if (!confirmClear) return setConfirmClear(true);
              setConfirmClear(false);
              clearConversation();
            }}
            variant={confirmClear ? "solid" : "ghost"}
            isDisabled={messages.length === 0 || isTyping}
          >
            {confirmClear ? "Clear chat?" : "Clear"}
          </Button>
          <Tooltip label="Settings">
            <IconButton aria-label="Settings" icon={<FiSettings />} size="sm" variant="ghost" onClick={settingsModal.onOpen} isDisabled={isTyping} />
          </Tooltip>
          <Tooltip label="Close">
            <IconButton aria-label="Close assistant" icon={<FiX />} size="sm" variant="ghost" onClick={onClose} />
          </Tooltip>
        </HStack>
      </Flex>

      <Box flex="1" overflowY="auto" px={{ base: 4, md: 6 }} py={5} display="flex" flexDirection="column">
        <Box w="full" flex="1">
          {messages.length === 0 ? (
            <Flex direction="column" align="center" justify="center" h="full" textAlign="center" py={10}>
              <Box p={4} borderRadius="full" bg="purple.500" color="white" shadow="lg" mb={5}>
                <Icon as={IoSparklesOutline} w={8} h={8} />
              </Box>
              <Heading size="md" mb={2}>
                Start a new conversation
              </Heading>
              <Text color={mutedText} maxW="420px" fontSize="sm">
                Talk to me like a friend who knows your library. I can add games, change statuses, rate,
                take notes, organise collections, answer questions and suggest what to play.
              </Text>
              <Wrap justify="center" spacing={2} mt={5} maxW="520px">
                {prompts.map((prompt) => (
                  <WrapItem key={prompt}>
                    <Button size="sm" variant="outline" colorScheme="purple" borderRadius="full" onClick={() => sendMessage(prompt)}>
                      {prompt}
                    </Button>
                  </WrapItem>
                ))}
              </Wrap>
            </Flex>
          ) : (
            <MessageBubbles
              messages={messages}
              onSelectClarification={(option) => sendMessage(option.label)}
              onRetry={(index) => {
                const failedMsg = messages[index];
                if (failedMsg) retry(failedMsg.id);
              }}
            />
          )}

          {isTyping && (
            <Box mt={4}>
              <TypingIndicator />
            </Box>
          )}

          <div ref={messagesEndRef} />
        </Box>
      </Box>

      <ChatInput onSendMessage={sendMessage} isDisabled={isTyping} />

      <AISettingsModal isOpen={settingsModal.isOpen} onClose={settingsModal.onClose} settings={settings} onSave={updateSettings} />
    </Flex>
  );
}
