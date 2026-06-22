import {
  Button,
  Text,
  useToast,
  VStack,
} from "@chakra-ui/react";

import { useState } from "react";
import { useNavigate } from "react-router-dom";

import settingsApi from "../api/settingsApi";
import { useAuth } from "../../auth/context/AuthContext";
import { getErrorMessage } from "../../../shared/utils/error";
import SettingsModal from "./SettingsModal";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function LogoutAllDevicesModal({
  isOpen,
  onClose,
}: Props) {
  const [loading, setLoading] =
    useState(false);

  const toast = useToast();

  const navigate = useNavigate();

  const { logout } = useAuth();

  const handleSubmit = async () => {
    try {
      setLoading(true);

      await settingsApi.logoutAllDevices();

      toast({
        title:
          "Logged out from all devices",
        status: "success",
      });

      await logout();

      navigate("/login");
    } catch (error: unknown) {
      toast({
        title: "Failed",
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
    title="Logout All Devices"
    footer={
      <>
        <Button
          mr={3}
          onClick={onClose}
        >
          Cancel
        </Button>

        <Button
          colorScheme="orange"
          isLoading={loading}
          onClick={handleSubmit}
        >
          Logout Everywhere
        </Button>
      </>
    }
  >
    <VStack
      align="stretch"
      spacing={4}
    >
      <Text>
        RoninArc will revoke all
        active sessions.
      </Text>

      <Text
        color="orange.400"
        fontSize="sm"
      >
        You'll be signed out from
        every device including
        this one.
      </Text>
    </VStack>
  </SettingsModal>
);
}