import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Text,
  useToast,
} from "@chakra-ui/react";

import { useState } from "react";
import { useNavigate } from "react-router-dom";

import settingsApi from "../api/settingsApi";
import { useAuth } from "../../../context/AuthContext";

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
    } catch (error: any) {
      toast({
        title: "Failed",
        description:
          error?.response?.data?.error ||
          "Something went wrong",
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
    >
      <ModalOverlay />

      <ModalContent>
        <ModalHeader>
          Logout All Devices
        </ModalHeader>

        <ModalBody>
          <Text>
            This will revoke all active
            sessions and sign you out
            everywhere.
          </Text>
        </ModalBody>

        <ModalFooter>
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
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}