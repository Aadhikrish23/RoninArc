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
  FormControl,
  FormLabel,
  Select,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  Text,
  VStack,
  HStack,
  Icon,
  useColorModeValue,
} from "@chakra-ui/react";
import type { JSX } from "react";
import { FiSettings, FiSliders } from "react-icons/fi";

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
          <VStack spacing={6} align="stretch">
            {/* System Persona */}
            <FormControl>
              <FormLabel fontSize="sm" fontWeight="bold" display="flex" alignItems="center" gap={2}>
                <Icon as={FiSliders} color="purple.500" />
                Assistant Persona
              </FormLabel>
              <Select
                value={localSettings.systemPersona}
                onChange={(e) =>
                  setLocalSettings((prev) => ({
                    ...prev,
                    systemPersona: e.target.value as AISettings["systemPersona"],
                  }))
                }
                borderRadius="xl"
                size="md"
              >
                <option value="default">Default (Balanced & Friendly)</option>
                <option value="technical">Technical (Detailed & Direct)</option>
                <option value="gamer">Gamer (Casual & Playful)</option>
              </Select>
              <Text fontSize="xs" color="gray.500" mt={2}>
                Customize how the AI phrases explanations, steps, and game reviews.
              </Text>
            </FormControl>

            {/* Temperature Slider */}
            <FormControl>
              <HStack justify="space-between" mb={2}>
                <FormLabel fontSize="sm" fontWeight="bold" mb={0}>
                  Creativity (Temperature)
                </FormLabel>
                <Text fontSize="xs" fontWeight="bold" color="purple.500">
                  {localSettings.temperature.toFixed(1)}
                </Text>
              </HStack>
              <Slider
                min={0}
                max={1}
                step={0.1}
                value={localSettings.temperature}
                onChange={(val) =>
                  setLocalSettings((prev) => ({
                    ...prev,
                    temperature: val,
                  }))
                }
              >
                <SliderTrack bg="purple.100">
                  <SliderFilledTrack bg="purple.500" />
                </SliderTrack>
                <SliderThumb boxSize={6} bg="purple.500" borderWidth="2px" borderColor="white" />
              </Slider>
              <Text fontSize="xs" color="gray.500" mt={2}>
                Lower values are more factual and direct; higher values are more creative and varied.
              </Text>
            </FormControl>
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
