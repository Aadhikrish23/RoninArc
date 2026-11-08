import {
  Button,
  FormControl,
  FormLabel,
  Input,
  Text,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import settingsApi from "../api/settingsApi";
import { useAuth } from "../../auth/context/AuthContext";
import SettingsModal from "./SettingsModal";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function ChangePasswordModal({
  isOpen,
  onClose,
}: Props) {
  const [currentPassword, setCurrentPassword] =
    useState("");

  const [newPassword, setNewPassword] =
    useState("");

  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const toast = useToast();

  const navigate = useNavigate();

  const { logout } = useAuth();

  const handleSubmit = async () => {
    try {
      if (
        newPassword !== confirmPassword
      ) {
        throw new Error(
          "Passwords do not match"
        );
      }

      setLoading(true);

      await settingsApi.changePassword(
        currentPassword,
        newPassword
      );

      toast({
        title: "Password changed",
        status: "success",
      });

      await logout();

      navigate("/login");
    } catch (error: any) {
      toast({
        title: "Failed",
        description:
          error?.response?.data?.error ||
          error.message,
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
    title="Change password"
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
          colorScheme="purple"
          isLoading={loading}
          onClick={handleSubmit}
        >
          Change password
        </Button>
      </>
    }
  >
    <VStack
      spacing={5}
      align="stretch"
    >
      <FormControl>
        <FormLabel>
          Current password
        </FormLabel>

        <Input
          type="password"
          value={currentPassword}
          onChange={(e) =>
            setCurrentPassword(
              e.target.value
            )
          }
        />
      </FormControl>

      <FormControl>
        <FormLabel>
          New password
        </FormLabel>

        <Input
          type="password"
          value={newPassword}
          onChange={(e) =>
            setNewPassword(
              e.target.value
            )
          }
        />
      </FormControl>

      <FormControl>
        <FormLabel>
          Confirm password
        </FormLabel>

        <Input
          type="password"
          value={confirmPassword}
          onChange={(e) =>
            setConfirmPassword(
              e.target.value
            )
          }
        />
      </FormControl>
      <Text fontSize="sm" color="gray.500">
        You'll be signed out afterwards. Sign in with the new password.
      </Text>
    </VStack>
  </SettingsModal>
);
}