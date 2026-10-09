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
} from "@chakra-ui/react";
import { useEffect, useRef } from "react";
import type { JSX } from "react";
import { FiSettings, FiTrash2, FiX } from "react-icons/fi";
import { IoSparklesOutline } from "react-icons/io5";
import { useAI } from "../context/AIContext";
import MessageBubbles from "./MessageBubbles";
import TypingIndicator from "./TypingIndicator";
import ChatInput from "./ChatInput";
import AISettingsModal from "./AISettingsModal";

interface AIChatPanelProps {
  onClose: () => void;
}

/** The whole assistant conversation, sized to live inside the quick-access modal. */
export default function AIChatPanel({ onClose }: AIChatPanelProps): JSX.Element {
  const { messages, isTyping, sendMessage, clearConversation, retry, settings, updateSettings } = useAI();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const settingsModal = useDisclosure();

  const headerBg = useColorModeValue("white", "gray.900");
  const borderColor = useColorModeValue("gray.200", "gray.700");
  const mutedText = useColorModeValue("gray.500", "gray.400");

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
            variant="ghost"
            colorScheme="red"
            onClick={clearConversation}
            isDisabled={messages.length === 0 || isTyping}
          >
            Clear
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
              <Box p={4} borderRadius="full" bgGradient="linear(to-tr, purple.500, blue.500)" color="white" shadow="lg" mb={5}>
                <Icon as={IoSparklesOutline} w={8} h={8} />
              </Box>
              <Heading size="md" mb={2}>
                Start a new conversation
              </Heading>
              <Text color={mutedText} maxW="400px" fontSize="sm">
                Ask me anything about your games, collections, launcher state, or game reviews!
              </Text>
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
