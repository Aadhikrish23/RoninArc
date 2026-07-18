import {
  Box,
  InputGroup,
  InputRightElement,
  IconButton,
  Textarea,
  useColorModeValue,
} from "@chakra-ui/react";
import { useState } from "react";
import type { JSX, KeyboardEvent, ChangeEvent } from "react";
import { FiSend } from "react-icons/fi";

interface ChatInputProps {
  onSendMessage: (text: string) => void;
  isDisabled: boolean;
}

export default function ChatInput({
  onSendMessage,
  isDisabled,
}: ChatInputProps): JSX.Element {
  const [text, setText] = useState("");
  const inputBg = useColorModeValue("white", "gray.850");
  const borderColor = useColorModeValue("gray.200", "gray.700");

  const handleSend = () => {
    if (!text.trim() || isDisabled) return;
    onSendMessage(text);
    setText("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
  };

  return (
    <Box
      p={4}
      bg={useColorModeValue("gray.50", "gray.900")}
      borderTopWidth="1px"
      borderColor={borderColor}
    >
      <InputGroup size="lg" maxW="800px" mx="auto">
        <Textarea
          placeholder={isDisabled ? "AI Assistant is thinking..." : "Type a message..."}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          isDisabled={isDisabled}
          bg={inputBg}
          borderColor={borderColor}
          borderRadius="2xl"
          pr="4.5rem"
          pl={4}
          py={3}
          minH="54px"
          maxH="150px"
          resize="none"
          fontSize="md"
          rows={1}
          shadow="sm"
          _focus={{
            borderColor: "purple.500",
            boxShadow: "0 0 0 1px var(--chakra-colors-purple-500)",
          }}
        />
        <InputRightElement h="full" pr={2} display="flex" alignItems="center">
          <IconButton
            aria-label="Send message"
            icon={<FiSend />}
            colorScheme="purple"
            borderRadius="xl"
            onClick={handleSend}
            isDisabled={!text.trim() || isDisabled}
            size="md"
          />
        </InputRightElement>
      </InputGroup>
    </Box>
  );
}
