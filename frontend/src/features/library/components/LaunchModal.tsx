import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  VStack,
  HStack,
  Input,
  Button,
  Text,
} from "@chakra-ui/react";

import type { Game } from "../types/library";

interface LaunchModalProps {
  game: Game | null;

  launchPath: string;

  onClose: () => void;

  onEditPath: () => void;

  onLaunch: () => void;
}

export default function LaunchModal({
  game,
  launchPath,
  onClose,
  onEditPath,
  onLaunch,
}: LaunchModalProps) {
  if (!game) return null;

  return (
    <Modal
      isOpen={!!game}
      onClose={onClose}
      isCentered
    >
      <ModalOverlay />

      <ModalContent>
        <ModalHeader>
          Launch {game.title}
        </ModalHeader>

        <ModalCloseButton />

        <ModalBody>
          <VStack
            align="stretch"
            spacing={3}
          >
            <Text
              fontSize="sm"
              color="gray.500"
            >
              Choose the executable file for
              this game.
            </Text>

            <HStack>
              <Input
                value={launchPath}
                isReadOnly
                placeholder="No path selected"
              />

              <Button
                size="sm"
                onClick={onEditPath}
              >
                Edit
              </Button>
            </HStack>

            {launchPath && (
              <Text
                fontSize="xs"
                color="gray.500"
              >
                Path will be saved for future
                launches.
              </Text>
            )}
          </VStack>
        </ModalBody>

        <ModalFooter>
          <Button
            variant="ghost"
            mr={3}
            onClick={onClose}
          >
            Cancel
          </Button>

          <Button
            colorScheme="purple"
            onClick={onLaunch}
            isDisabled={!launchPath}
          >
            Launch
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}