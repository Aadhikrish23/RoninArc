/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from "react";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  Text,
  VStack,
  Icon,
  useColorModeValue,
} from "@chakra-ui/react";
import type { JSX } from "react";
import { FiSettings } from "react-icons/fi";

export interface AISettings {
  systemPersona: "default" | "technical" | "gamer";
  temperature: number;
}

interface AISettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AISettings;
  onSave: (settings: AISettings) => void;
}

export default function AISettingsModal({
  isOpen,
  onClose,
  settings,
  onSave,
}: AISettingsModalProps): JSX.Element {
  const [localSettings, setLocalSettings] = useState<AISettings>({ ...settings });

  // Sync state when modal opens
  useEffect(() => {
    if (isOpen) {
      setLocalSettings({ ...settings });
    }
  }, [isOpen, settings]);

  const handleSave = () => {
    onSave(localSettings);
    onClose();
  };

  const bg = useColorModeValue("white", "gray.900");
  const headerBg = useColorModeValue("purple.50", "purple.950");
  const headerText = useColorModeValue("purple.800", "purple.200");

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered size="md">
      <ModalOverlay backdropFilter="blur(8px)" />
      <ModalContent bg={bg} borderRadius="2xl" overflow="hidden" shadow="2xl">
        <ModalHeader
          bg={headerBg}
          color={headerText}
          display="flex"
          alignItems="center"
          gap={2}
          borderBottomWidth="1px"
          borderColor={useColorModeValue("purple.100", "purple.900")}
        >
          <Icon as={FiSettings} />
          AI Assistant Settings
        </ModalHeader>
        <ModalCloseButton color={headerText} />

        <ModalBody py={6}>
          <VStack spacing={4} align="stretch">
            <Text fontSize="sm" color="gray.500">
              Model parameters (such as creativity temperature and system prompt persona) are pre-configured on the backend Ollama service and cannot be modified dynamically.
            </Text>
          </VStack>
        </ModalBody>

        <ModalFooter gap={3}>
          <Button variant="ghost" onClick={onClose} borderRadius="xl">
            Cancel
          </Button>
          <Button colorScheme="purple" onClick={handleSave} borderRadius="xl">
            Save Changes
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
