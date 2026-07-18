import {
  Box,
  VStack,
  Button,
  Text,
  Divider,
  Icon,
  Heading,
  HStack,
  useColorModeValue,
  Badge,
} from "@chakra-ui/react";
import type { JSX } from "react";
import { FiTrash2, FiPlus, FiMessageSquare, FiSettings } from "react-icons/fi";
import { IoSparklesOutline } from "react-icons/io5";

interface ChatSidebarProps {
  onNewChat: () => void;
  messageCount: number;
  isTyping: boolean;
  onOpenSettings: () => void;
}

export default function ChatSidebar({
  onNewChat,
  messageCount,
  isTyping,
  onOpenSettings,
}: ChatSidebarProps): JSX.Element {
  const sidebarBg = useColorModeValue("white", "gray.900");
  const borderColor = useColorModeValue("gray.200", "gray.800");
  const mutedText = useColorModeValue("gray.500", "gray.400");

  return (
    <Box
      w={{ base: "full", md: "260px" }}
      borderRightWidth="1px"
      borderColor={borderColor}
      bg={sidebarBg}
      p={4}
      display="flex"
      flexDirection="column"
      h="full"
    >
      {/* Sidebar Header */}
      <HStack spacing={3} mb={6}>
        <Icon as={IoSparklesOutline} w={5} h={5} color="purple.500" />
        <Heading size="xs" textTransform="uppercase" letterSpacing="wider">
          AI Sessions
        </Heading>
      </HStack>

      <VStack align="stretch" spacing={4} flex="1">
        {/* New Chat Button */}
        <Button
          leftIcon={<FiPlus />}
          colorScheme="purple"
          variant="solid"
          size="md"
          borderRadius="xl"
          onClick={onNewChat}
          isDisabled={isTyping}
          shadow="sm"
          _hover={{
            transform: "translateY(-1px)",
            shadow: "md",
          }}
          transition="all 0.2s"
        >
          New Chat
        </Button>

        <Divider borderColor={borderColor} />

        {/* Current Active Conversation Details */}
        <Box flex="1" overflowY="auto">
          <Text fontSize="xs" fontWeight="bold" color={mutedText} mb={2}>
            ACTIVE SESSION
          </Text>
          <HStack
            p={3}
            borderRadius="xl"
            bg="purple.900"
            color="white"
            spacing={3}
            borderWidth="1px"
            borderColor="purple.700"
          >
            <Icon as={FiMessageSquare} color="purple.300" />
            <Box flex="1" overflow="hidden">
              <Text fontSize="sm" fontWeight="semibold" isTruncated>
                Current Discussion
              </Text>
              <Text fontSize="xs" color="purple.300">
                {messageCount} {messageCount === 1 ? "message" : "messages"}
              </Text>
            </Box>
            <Badge colorScheme="purple" variant="solid" fontSize="9px">
              Active
            </Badge>
          </HStack>
        </Box>
      </VStack>

      <Box pt={4}>
        <Divider borderColor={borderColor} mb={4} />
        <HStack spacing={2}>
          <Button
            leftIcon={<FiTrash2 />}
            variant="outline"
            colorScheme="red"
            size="sm"
            flex="1"
            borderRadius="xl"
            onClick={onNewChat}
            isDisabled={messageCount === 0 || isTyping}
            _hover={{ bg: "red.500", color: "white" }}
          >
            Clear
          </Button>
          <Button
            leftIcon={<FiSettings />}
            variant="outline"
            colorScheme="purple"
            size="sm"
            flex="1"
            borderRadius="xl"
            onClick={onOpenSettings}
            isDisabled={isTyping}
          >
            Settings
          </Button>
        </HStack>
      </Box>
    </Box>
  );
}
