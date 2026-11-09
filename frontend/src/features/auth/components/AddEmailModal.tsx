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
  Stack,
  Text,
  useToast,
} from "@chakra-ui/react";
import authApi from "../api/authApi";
import { useAuth } from "../context/AuthContext";
import { getErrorMessage } from "../../../shared/utils/error";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * RoninArc signs in with an email. Accounts made on a PC before that have none: this asks for it
 * (the password confirms it's you). "Later" keeps you signed in; Settings keeps offering it.
 */
export default function AddEmailModal({ isOpen, onClose, onAdded }: { isOpen: boolean; onClose: () => void; onAdded?: () => void }) {
  const { updateUser } = useAuth();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const save = async () => {
    if (!EMAIL.test(email.trim())) return setProblem("Enter a valid email address.");
    if (!password) return setProblem("Enter your password to confirm it's you.");
    setBusy(true);
    setProblem(null);
    try {
      const data = await authApi.setEmail(email, password);
      updateUser({ email: data.email });
      setPassword("");
      toast({ title: "Email added", description: "Sign in with it from now on.", status: "success", duration: 5000, isClosable: true });
      onAdded?.();
      onClose();
    } catch (error) {
      setProblem(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered>
      <ModalOverlay />
      <ModalContent borderRadius="xl" mx={4}>
        <ModalHeader>Add your email</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Stack spacing={4}>
            <Text fontSize="sm">
              RoninArc now signs in with your email. Add it once and use it next time you sign in, on this PC and on your phone. It's also how you reset a forgotten
              password.
            </Text>
            <FormControl>
              <FormLabel fontSize="sm">Email</FormLabel>
              <Input type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </FormControl>
            <FormControl>
              <FormLabel fontSize="sm">Password</FormLabel>
              <Input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void save();
                }}
              />
            </FormControl>
            {problem && (
              <Text fontSize="sm" color="red.400" role="alert">
                {problem}
              </Text>
            )}
          </Stack>
        </ModalBody>
        <ModalFooter gap={2}>
          <Button variant="ghost" onClick={onClose}>
            Later
          </Button>
          <Button colorScheme="purple" isLoading={busy} onClick={save}>
            Add email
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
