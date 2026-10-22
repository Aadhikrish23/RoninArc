import { useState } from "react";
import {
  Button,
  FormControl,
  FormLabel,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
} from "@chakra-ui/react";
import syncApi from "../../settings/api/syncApi";
import { getErrorMessage } from "../../../shared/utils/error";

/**
 * Emails a reset link. Works for accounts that sync with RoninArc Cloud (the email lives
 * there); the new password then works here on the next sign-in.
 */
export default function ForgotPasswordModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [identifier, setIdentifier] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setSent(null);
    setError(null);
    onClose();
  };

  const send = async () => {
    setSending(true);
    setError(null);
    try {
      const res = await syncApi.forgotPassword(identifier.trim());
      setSent(res.Message);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={close} isCentered>
      <ModalOverlay />
      <ModalContent bg="gray.800" color="white">
        <ModalHeader>Reset your password</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {sent ? (
            <Text color="gray.200" aria-live="polite">
              {sent} Then sign in here with the new password.
            </Text>
          ) : (
            <>
              <Text fontSize="sm" color="gray.300" mb={4}>
                We'll email you a link to set a new one. This works for accounts that sync with RoninArc Cloud.
              </Text>
              <FormControl>
                <FormLabel color="gray.200">Email or username</FormLabel>
                <Input
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && identifier.trim() && !sending) send();
                  }}
                  bg="gray.900"
                  borderColor="gray.700"
                  _focus={{ borderColor: "purple.400", boxShadow: "0 0 0 1px #9F7AEA" }}
                  autoFocus
                />
              </FormControl>
              {error && (
                <Text mt={3} fontSize="sm" color="red.300" role="alert">
                  {error}
                </Text>
              )}
            </>
          )}
        </ModalBody>
        <ModalFooter>
          {sent ? (
            <Button colorScheme="purple" onClick={close}>
              Back to sign in
            </Button>
          ) : (
            <Button colorScheme="purple" onClick={send} isLoading={sending} loadingText="Sending" isDisabled={!identifier.trim()}>
              Email me a link
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
