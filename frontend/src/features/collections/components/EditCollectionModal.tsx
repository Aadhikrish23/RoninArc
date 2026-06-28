import {
  Button,
  FormControl,
  FormLabel,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Textarea,
  VStack,
} from "@chakra-ui/react";

import { useEffect, useState } from "react";

import type { Collection } from "../types/collection";

interface Props {
  isOpen: boolean;

  onClose: () => void;

  collection: Collection;

  onSave: (
    name: string,
    description?: string
  ) => Promise<void>;
}

export default function EditCollectionModal({
  isOpen,
  onClose,
  collection,
  onSave,
}: Props) {
  const [name, setName] = useState("");

  const [description, setDescription] = useState("");

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(collection.name);
      setDescription(collection.description || "");
    }
  }, [collection, isOpen]);

  const handleSave = async () => {
    if (!name.trim()) return;

    try {
      setLoading(true);

      await onSave(name.trim(), description.trim());

      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      isCentered
    >
      <ModalOverlay />

      <ModalContent>
        <ModalHeader>Edit Collection</ModalHeader>

        <ModalBody>
          <VStack spacing={4}>
            <FormControl isRequired>
              <FormLabel>Name</FormLabel>

              <Input
                value={name}
                onChange={(e) =>
                  setName(e.target.value)
                }
                placeholder="Collection Name"
              />
            </FormControl>

            <FormControl>
              <FormLabel>Description</FormLabel>

              <Textarea
                value={description}
                onChange={(e) =>
                  setDescription(e.target.value)
                }
                placeholder="Collection description..."
                resize="vertical"
              />
            </FormControl>
          </VStack>
        </ModalBody>

        <ModalFooter gap={2}>
          <Button
            variant="ghost"
            onClick={onClose}
            isDisabled={loading}
          >
            Cancel
          </Button>

          <Button
            colorScheme="purple"
            isLoading={loading}
            onClick={handleSave}
          >
            Save Changes
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}