import {
  Box,
  Button,
  ListItem,
  UnorderedList,
  useColorModeValue,
  FormControl,
  FormLabel,
  Input,
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
  const muted = useColorModeValue("gray.600", "gray.400");

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
    title="Delete account"
    footer={
      <>
        <Button
          variant="ghost"
          mr={2}
          onClick={onClose}
        >
          Cancel
        </Button>

        <Button
          colorScheme="red"
          isLoading={loading}
          onClick={handleDelete}
        >
          Delete account
        </Button>
      </>
    }
  >
    <VStack
      align="stretch"
      spacing={4}
    >
      <Box>
        <Text mb={2}>This permanently removes:</Text>
        <UnorderedList color={muted} fontSize="sm" spacing={0.5}>
          <ListItem>your account</ListItem>
          <ListItem>your library, reviews and collections</ListItem>
          <ListItem>your activity history</ListItem>
        </UnorderedList>
        <Text mt={3} fontSize="sm" color={muted}>
          This can't be undone.
        </Text>
      </Box>

      <FormControl>
        <FormLabel>
          Confirm password
        </FormLabel>

        <Input
          type="password"
          value={password}
          autoComplete="current-password"
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