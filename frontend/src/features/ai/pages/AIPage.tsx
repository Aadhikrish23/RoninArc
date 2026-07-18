import {
  Box,
  Flex,
  Heading,
  Icon,
  Text,
  useColorModeValue,
  useDisclosure,
} from "@chakra-ui/react";
import { useEffect, useRef } from "react";
import type { JSX } from "react";
import { IoSparklesOutline } from "react-icons/io5";
import { useAI } from "../context/AIContext";
import ChatSidebar from "../components/ChatSidebar";
import MessageBubbles from "../components/MessageBubbles";
import TypingIndicator from "../components/TypingIndicator";
import ChatInput from "../components/ChatInput";
import AISettingsModal from "../components/AISettingsModal";

export default function AIPage(): JSX.Element {
  const { messages, isTyping, sendMessage, clearConversation, retry, settings, updateSettings } = useAI();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();

  const bg = useColorModeValue("gray.50", "gray.900");
  const headerBg = useColorModeValue("whiteAlpha.900", "gray.900");
  const borderColor = useColorModeValue("gray.200", "gray.800");

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Scroll to bottom on new messages or typing change
  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  return (
    <Flex h="calc(100vh - 73px)" bg={bg} overflow="hidden" direction={{ base: "column", md: "row" }}>
      {/* Sidebar */}
      <ChatSidebar
        onNewChat={clearConversation}
        messageCount={messages.length}
        isTyping={isTyping}
        onOpenSettings={onOpen}
      />

      {/* Main Chat Interface */}
      <Flex direction="column" flex="1" h="full" overflow="hidden">
        {/* Chat Header */}
        <Flex
          as="header"
          align="center"
          px={6}
          py={4}
          bg={headerBg}
          borderBottomWidth="1px"
          borderColor={borderColor}
          backdropFilter="blur(12px)"
          zIndex={2}
        >
          <Icon as={IoSparklesOutline} w={5} h={5} color="purple.500" mr={3} />
          <Box>
            <Heading size="sm">RoninArc AI Assistant</Heading>
            <Text fontSize="xs" color="gray.500">
              {isTyping ? "AI is thinking..." : "Online & ready to help"}
            </Text>
          </Box>
        </Flex>

        {/* Messages Scroll Area */}
        <Box
          flex="1"
          overflowY="auto"
          px={{ base: 4, md: 8 }}
          py={6}
          display="flex"
          flexDirection="column"
        >
          <Box maxW="800px" w="full" mx="auto" flex="1">
            {messages.length === 0 ? (
              // Empty State
              <Flex
                direction="column"
                align="center"
                justify="center"
                h="full"
                textAlign="center"
                py={20}
              >
                <Box
                  p={4}
                  borderRadius="full"
                  bgGradient="linear(to-tr, purple.500, blue.500)"
                  color="white"
                  shadow="lg"
                  mb={6}
                  style={{
                    animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                  }}
                >
                  <Icon as={IoSparklesOutline} w={10} h={10} />
                </Box>
                <Heading size="md" mb={2}>
                  Start a new conversation
                </Heading>
                <Text color="gray.500" maxW="400px" fontSize="sm">
                  Ask me anything about your games, collections, launcher state, or game reviews!
                </Text>
              </Flex>
            ) : (
              <MessageBubbles
                messages={messages}
                onSelectClarification={(option) => {
                  sendMessage(option.label);
                }}
                onRetry={(index) => {
                  const failedMsg = messages[index];
                  if (failedMsg) {
                    retry(failedMsg.id);
                  }
                }}
              />
            )}

            {/* Typing Indicator */}
            {isTyping && <Box mt={4}><TypingIndicator /></Box>}

            {/* Scroll Anchor */}
            <div ref={messagesEndRef} />
          </Box>
        </Box>

        {/* Chat Input */}
        <ChatInput onSendMessage={sendMessage} isDisabled={isTyping} />
      </Flex>

      {/* AI Settings Modal */}
      <AISettingsModal
        isOpen={isOpen}
        onClose={onClose}
        settings={settings}
        onSave={updateSettings}
      />
    </Flex>
  );
}
