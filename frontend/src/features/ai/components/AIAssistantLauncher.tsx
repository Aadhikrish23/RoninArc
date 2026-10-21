/* eslint-disable react-refresh/only-export-components */
import { Icon, IconButton, Modal, ModalContent, ModalOverlay, Tooltip, useDisclosure } from "@chakra-ui/react";
import { createContext, useContext } from "react";
import type { JSX, ReactNode } from "react";
import { IoSparklesOutline } from "react-icons/io5";
import AIChatPanel from "./AIChatPanel";

interface AIAssistantLauncherValue {
  open: () => void;
  close: () => void;
  isOpen: boolean;
}

const AIAssistantLauncherContext = createContext<AIAssistantLauncherValue | undefined>(undefined);

/**
 * Quick access to the AI assistant from every signed-in page: a floating
 * button in the corner that opens the chat in a modal. The conversation lives
 * in AIContext, so closing the modal keeps it.
 */
export function AIAssistantLauncherProvider({ children }: { children: ReactNode }): JSX.Element {
  const { isOpen, onOpen, onClose } = useDisclosure();

  return (
    <AIAssistantLauncherContext.Provider value={{ open: onOpen, close: onClose, isOpen }}>
      {children}

      {!isOpen && (
        <Tooltip label="AI Assistant" placement="left" hasArrow>
          <IconButton
            aria-label="Open AI Assistant"
            icon={<Icon as={IoSparklesOutline} w={6} h={6} />}
            onClick={onOpen}
            position="fixed"
            bottom={6}
            right={6}
            zIndex="sticky"
            w="56px"
            h="56px"
            borderRadius="full"
            colorScheme="purple"
            bg="purple.500"
            _hover={{ bg: "purple.600", transform: "translateY(-2px)", shadow: "2xl" }}
            color="white"
            shadow="xl"
            transition="all 0.2s"
          />
        </Tooltip>
      )}

      <Modal isOpen={isOpen} onClose={onClose} size="3xl" motionPreset="slideInBottom">
        <ModalOverlay />
        <ModalContent aria-label="AI Assistant" h="min(720px, 85vh)" my="7.5vh" overflow="hidden" borderRadius="xl">
          <AIChatPanel onClose={onClose} />
        </ModalContent>
      </Modal>
    </AIAssistantLauncherContext.Provider>
  );
}

export function useAIAssistantLauncher(): AIAssistantLauncherValue {
  const ctx = useContext(AIAssistantLauncherContext);
  if (!ctx) throw new Error("useAIAssistantLauncher must be used inside AIAssistantLauncherProvider");
  return ctx;
}
