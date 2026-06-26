import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Text,
  Button,
  VStack,
} from "@chakra-ui/react";

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function FirstLaunchModal() {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const hasSeenWizard = localStorage.getItem("roninarc_import_wizard_seen");

    if (!hasSeenWizard) {
      setIsOpen(true);
    }
  }, []);

  const handleSkip = () => {
    localStorage.setItem("roninarc_import_wizard_seen", "true");
    setIsOpen(false);
  };

  const handleContinue = () => {
    localStorage.setItem("roninarc_import_wizard_seen", "true");
    setIsOpen(false);
    navigate("/settings");
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {}}
      closeOnEsc={false}
      closeOnOverlayClick={false}
      isCentered
    >
      <ModalOverlay />

      <ModalContent>
        <ModalHeader>Welcome to RoninArc</ModalHeader>

        <ModalBody>
          <VStack align="start" spacing={3}>
            <Text>Connect your game library accounts to get started.</Text>

            <Text fontSize="sm" color="gray.500">
              RoninArc supports automatic library syncing from major gaming platforms.
            </Text>

            <Text fontSize="sm" color="gray.500">
              ✓ Epic Games — available now
            </Text>

            <Text fontSize="sm" color="gray.500">
              🔜 Steam, GOG, and more — coming soon
            </Text>
          </VStack>
        </ModalBody>

        <ModalFooter gap={3}>
          <Button variant="ghost" onClick={handleSkip}>
            Skip
          </Button>

          <Button colorScheme="purple" onClick={handleContinue}>
            Set Up Connections
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
