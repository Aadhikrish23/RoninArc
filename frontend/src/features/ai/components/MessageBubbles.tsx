import { useAI } from "../context/AIContext";
import { useAuth } from "../../auth/context/AuthContext";
import { Box, Flex, Avatar, Text, Icon, useColorModeValue } from "@chakra-ui/react";
import type { JSX } from "react";
import type { Message, ClarificationOption } from "../types/conversation";
import { IoSparklesOutline } from "react-icons/io5";
import MarkdownRenderer from "./MarkdownRenderer";
import ExecutionSummary from "./ExecutionSummary";
import ClarificationCard from "./ClarificationCard";
import ErrorCard from "./ErrorCard";

interface MessageBubblesProps {
  messages: Message[];
  onSelectClarification: (option: ClarificationOption) => void;
  onRetry: (index: number) => void;
}

export default function MessageBubbles({
  messages,
  onSelectClarification,
  onRetry,
}: MessageBubblesProps): JSX.Element {
  const { settings } = useAI();
  const { user } = useAuth();
  const assistantBg = useColorModeValue("gray.100", "gray.800");
  const assistantText = useColorModeValue("gray.800", "gray.100");
  const assistantBorder = useColorModeValue("gray.200", "gray.700");
  return (
    <Box display="flex" flexDirection="column" gap={4} w="full">
      {messages.map((message, index) => {
        const isUser = message.sender === "user";
        const isFailed = message.assistantStatus === "FAILED" || message.status === "error";

        return (
          <Flex
            key={message.id}
            justifyContent={isUser ? "flex-end" : "flex-start"}
            alignItems="flex-start"
            gap={3}
            w="full"
          >
            {/* Assistant Avatar */}
            {!isUser && (
              <Avatar
                size="sm"
                bg={isFailed ? "red.600" : "purple.600"}
                icon={<Icon as={IoSparklesOutline} color="white" />}
                shadow="md"
              />
            )}

            {/* Bubble Container */}
            <Box
              maxW={{ base: "85%", md: "70%" }}
              w="full"
              display="flex"
              flexDirection="column"
              alignItems={isUser ? "flex-end" : "flex-start"}
            >
              {isFailed && !isUser ? (
                <ErrorCard
                  message={message.text}
                  // Retrying only helps when the request never got through (offline, network);
                  // an answer like "I couldn't find X" would just repeat.
                  onRetry={message.status === "error" ? () => onRetry(index) : undefined}
                />
              ) : (
                <Box
                  w="full"
                  px={4}
                  py={3}
                  borderRadius="2xl"
                  borderBottomRightRadius={isUser ? "sm" : "2xl"}
                  borderBottomLeftRadius={isUser ? "2xl" : "sm"}
                  bg={isUser ? "purple.600" : assistantBg}
                  color={isUser ? "white" : assistantText}
                  borderWidth="1px"
                  borderColor={isUser ? "purple.500" : assistantBorder}
                  shadow="md"
                  position="relative"
                >
                  {isUser ? (
                    <Text fontSize="md" whiteSpace="pre-wrap" lineHeight="tall">
                      {message.text}
                    </Text>
                  ) : (
                    <>
                      <MarkdownRenderer content={message.text} />
                      {settings.showTechnicalDetails && message.status === "sent" && message.metrics && (
                        <ExecutionSummary
                          metrics={message.metrics}
                        />
                      )}
                    </>
                  )}

                  {/* Status and Timestamp */}
                  <Flex justify="flex-end" align="center" gap={1} mt={1.5}>
                    <Text fontSize="10px" color={isUser ? "purple.200" : "gray.500"}>
                      {new Date(message.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                    {isUser && message.status === "sending" && (
                      <Text fontSize="9px" color="purple.200">
                        •••
                      </Text>
                    )}
                    {isUser && message.status === "error" && (
                      <Text fontSize="10px" color="red.300">
                        Error
                      </Text>
                    )}
                  </Flex>
                </Box>
              )}

              {/* Clarification Request Card */}
              {!isUser && message.clarificationRequest && (
                <Box w="full" mt={2}>
                  <ClarificationCard
                    request={message.clarificationRequest}
                    onSelectOption={onSelectClarification}
                  />
                </Box>
              )}
            </Box>

            {/* User Avatar */}
            {isUser && (
              <Avatar
                size="sm"
                name={user?.name || "Player"}
                bg="purple.700"
                color="white"
                shadow="md"
              />
            )}
          </Flex>
        );
      })}
    </Box>
  );
}
