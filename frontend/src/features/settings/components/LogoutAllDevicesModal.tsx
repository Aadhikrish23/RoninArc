import {
  Button,
  Text,
  useToast,
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
    title="Log out of all devices"
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
          Log out everywhere
        </Button>
      </>
    }
  >
    <Text>
      This signs you out on every device, including this one. You can sign in again straight away.
    </Text>
  </SettingsModal>
);
}