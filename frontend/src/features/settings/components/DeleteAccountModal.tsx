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
  VStack,
} from "@chakra-ui/react";

import { useState } from "react";
import { useNavigate } from "react-router-dom";

import settingsApi from "../api/settingsApi";
import { getErrorMessage } from "../../../shared/utils/error";
import SettingsModal from "./SettingsModal";

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
  <SettingsModal
    isOpen={isOpen}
    onClose={onClose}
    title="Delete Account"
    footer={
      <>
        <Button
          variant="ghost"
          onClick={onClose}
        >
          Cancel
        </Button>

        <Button
          colorScheme="red"
          isLoading={loading}
          onClick={handleDelete}
        >
          Delete Account
        </Button>
      </>
    }
  >
    <VStack
      align="stretch"
      spacing={4}
    >
      <Text
        color="red.400"
        fontWeight="bold"
      >
        This action cannot be
        undone.
      </Text>

      <Text>
        Your account, library,
        reviews, collections and
        activity history will be
        permanently removed.
      </Text>

      <FormControl>
        <FormLabel>
          Confirm Password
        </FormLabel>

        <Input
          type="password"
          value={password}
          placeholder="Enter password"
          onChange={(e) =>
            setPassword(
              e.target.value
            )
          }
        />
      </FormControl>
    </VStack>
  </SettingsModal>
);
}