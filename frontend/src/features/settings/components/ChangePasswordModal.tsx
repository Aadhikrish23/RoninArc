import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  FormControl,
  FormLabel,
  Input,
  VStack,
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
    >
      <ModalOverlay />

      <ModalContent>
        <ModalHeader>
          Change Password
        </ModalHeader>

        <ModalBody>
          <VStack spacing={4}>
            <FormControl>
              <FormLabel>
                Current Password
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
                New Password
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
                Confirm Password
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
          </VStack>
        </ModalBody>

        <ModalFooter>
          <Button
            mr={3}
            onClick={onClose}
          >
            Cancel
          </Button>

          <Button
            colorScheme="purple"
            isLoading={loading}
            onClick={handleSubmit}
          >
            Update
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}