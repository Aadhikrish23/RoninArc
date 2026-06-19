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
  Text,
  useToast,
} from "@chakra-ui/react";

import { useState } from "react";
import { useNavigate } from "react-router-dom";

import settingsApi from "../api/settingsApi";
import { getErrorMessage } from "../../../shared/utils/error";

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DeleteAccountModal({
  isOpen,
  onClose,
}: DeleteAccountModalProps) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const toast = useToast();

  const handleDelete = async () => {
    if (!password.trim()) {
      toast({
        title: "Password required",
        status: "warning",
      });

      return;
    }

    try {
      setLoading(true);

      await settingsApi.deleteAccount(password);

      localStorage.clear();
      sessionStorage.clear();

      toast({
        title: "Account deleted",
        description:
          "Your account and all associated data have been permanently removed.",
        status: "success",
      });

      navigate("/login");
    } catch (error: unknown) {
      toast({
        title: "Delete failed",
       description: getErrorMessage(error),
        status: "error",
      });
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
        <ModalHeader>
          Delete Account
        </ModalHeader>

        <ModalBody>
          <Text
            mb={4}
            color="red.500"
            fontWeight="semibold"
          >
            Warning: This action cannot be
            undone.
          </Text>

          <Text mb={4}>
            All collections, reviews,
            activities and library entries
            will be permanently deleted.
          </Text>

          <FormControl>
            <FormLabel>
              Enter Password
            </FormLabel>

            <Input
              type="password"
              value={password}
              onChange={(e) =>
                setPassword(
                  e.target.value
                )
              }
              placeholder="Confirm your password"
            />
          </FormControl>
        </ModalBody>

        <ModalFooter gap={3}>
          <Button
            variant="ghost"
            onClick={onClose}
          >
            Cancel
          </Button>

          <Button
            colorScheme="red"
            onClick={handleDelete}
            isLoading={loading}
          >
            Delete Account
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}