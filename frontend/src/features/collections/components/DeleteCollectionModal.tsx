import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  Button,
  Text,
} from "@chakra-ui/react";

interface Props {
  isOpen: boolean;
  collectionName: string;
  onClose: () => void;
  onDelete: () => Promise<void>;
}

export default function DeleteCollectionModal({
  isOpen,
  collectionName,
  onClose,
  onDelete,
}: Props) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      isCentered
    >
      <ModalOverlay />

      <ModalContent>
        <ModalHeader>Delete Collection</ModalHeader>

        <ModalCloseButton />

        <ModalBody>
          <Text mb={3}>
            Are you sure you want to delete
            <b> "{collectionName}"</b>?
          </Text>

          <Text color="gray.500" fontSize="sm">
            This only deletes the collection.
            None of the games inside it will be removed from your library.
          </Text>
        </ModalBody>

        <ModalFooter>
          <Button
            mr={3}
            variant="ghost"
            onClick={onClose}
          >
            Cancel
          </Button>

          <Button
            colorScheme="red"
            onClick={onDelete}
          >
            Delete Collection
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}