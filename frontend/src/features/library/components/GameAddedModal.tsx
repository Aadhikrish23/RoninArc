import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Text,
  VStack,
} from "@chakra-ui/react";

interface Props {
  isOpen: boolean;

  gameTitle: string;

  onContinue: () => void;

  onViewLibrary: () => void;
}

export default function GameAddedModal({
  isOpen,
  gameTitle,
  onContinue,
  onViewLibrary,
}: Props) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onContinue}
      isCentered
    >
      <ModalOverlay />

      <ModalContent>
        <ModalHeader>
          Game Added
        </ModalHeader>

        <ModalBody>
          <VStack align="start">
            <Text fontWeight="bold">
              {gameTitle}
            </Text>

            <Text color="gray.500">
              has been added to your library.
            </Text>
          </VStack>
        </ModalBody>

        <ModalFooter gap={3}>
          <Button
            variant="ghost"
            onClick={onContinue}
          >
            Continue Browsing
          </Button>

          <Button
            colorScheme="purple"
            onClick={onViewLibrary}
          >
            View Library
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}