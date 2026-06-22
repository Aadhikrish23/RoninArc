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
import ImportWizardModal from "./ImportWizardModal";

export default function FirstLaunchModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [isImportOpen, setImportOpen] = useState(false);

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

    setImportOpen(true);
  };

  return (
    <>
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
            <Text>Would you like to import your existing game libraries?</Text>

            <Text fontSize="sm" color="gray.500">
              RoninArc can scan and import games from supported launchers.
            </Text>

            <Text fontSize="sm" color="gray.500">
              ✓ Epic Games
            </Text>

            <Text fontSize="sm" color="gray.500">
              ✓ Steam (Coming Soon)
            </Text>
          </VStack>
        </ModalBody>

        <ModalFooter gap={3}>
          <Button variant="ghost" onClick={handleSkip}>
            Skip
          </Button>

          <Button colorScheme="purple" onClick={handleContinue}>
            Continue
          </Button>
        </ModalFooter>
      </ModalContent>
      
    </Modal>
    <ImportWizardModal
        isOpen={isImportOpen}
        onClose={() => setImportOpen(false)}
      />
    </>
  );
}
