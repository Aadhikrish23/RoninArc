import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  Alert,
  AlertDescription,
  AlertIcon,
  Box,
  Button,
  Flex,
  Image,
  ListItem,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  OrderedList,
  Skeleton,
  Text,
  useColorModeValue,
} from "@chakra-ui/react";
import syncApi, { type SyncStatus } from "../api/syncApi";
import { getErrorMessage } from "../../../shared/utils/error";

/** What the QR code says: the phone app reads the six digits out of it. */
const linkUrl = (code: string) => `roninarc://link/${code}`;
const spaced = (code: string) => `${code.slice(0, 3)} ${code.slice(3)}`;

function left(expiresAt: string, now: number): string {
  const seconds = Math.max(0, Math.round((Date.parse(expiresAt) - now) / 1000));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * "Connect your phone": links this PC to RoninArc Cloud if it isn't yet (the same as "Sync to
 * cloud"), then shows a QR code and the 6-digit code under it. The phone scans or types it and
 * is signed in to this account, no password.
 */
export default function ConnectPhoneModal({ isOpen, onClose, onStatus }: { isOpen: boolean; onClose: () => void; onStatus?: (s: SyncStatus) => void }) {
  const muted = useColorModeValue("gray.600", "gray.400");
  const qrBg = "white";
  const [step, setStep] = useState<"linking" | "code" | "error">("linking");
  const [code, setCode] = useState<{ code: string; expiresAt: string; qr: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Ticks while a code is shown (set from the timer, not during render).
  const [now, setNow] = useState(0);

  const makeCode = useCallback(async () => {
    setError(null);
    setStep("linking");
    try {
      let status = await syncApi.status();
      if (!status.linked) {
        // Same as "Sync to cloud". A taken name becomes "needs attention" in Settings instead of an error here.
        status = await syncApi.autoLink();
        onStatus?.(status);
        if (!status.linked) {
          setError(
            status.autoLink?.attention === "name-taken"
              ? "Someone else already uses this name in RoninArc Cloud. Choose a name for syncing under RoninArc Cloud in Settings, then connect your phone."
              : status.autoLink?.waiting
                ? "This PC can't reach RoninArc Cloud right now. Check your internet connection and try again."
                : (status.autoLink?.message ?? "Couldn't turn on sync."),
          );
          setStep("error");
          return;
        }
      }
      const made = await syncApi.phoneCode();
      const qr = await QRCode.toDataURL(linkUrl(made.code), { margin: 1, width: 220, errorCorrectionLevel: "M" });
      setCode({ ...made, qr });
      setNow(Date.now());
      setStep("code");
    } catch (e) {
      setError(getErrorMessage(e));
      setStep("error");
    }
  }, [onStatus]);

  useEffect(() => {
    if (!isOpen) return;
    // Started from a timer (not during the effect itself); a quick close cancels it.
    const timer = setTimeout(() => void makeCode(), 0);
    return () => clearTimeout(timer);
  }, [isOpen, makeCode]);

  useEffect(() => {
    if (!isOpen || step !== "code") return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [isOpen, step]);

  const expired = !!code && Date.parse(code.expiresAt) <= now;

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered size="md">
      <ModalOverlay />
      <ModalContent borderRadius="xl">
        <ModalHeader>Connect your phone</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {step === "linking" && (
            <Box aria-busy="true">
              <Text fontSize="sm" color={muted} mb={4}>
                Getting your library ready for your phone. The first time, RoninArc Cloud can take up to a minute to wake up.
              </Text>
              <Skeleton h="220px" w="220px" mx="auto" borderRadius="lg" />
            </Box>
          )}
          {step === "error" && (
            <Alert status="warning" borderRadius="md">
              <AlertIcon />
              <AlertDescription fontSize="sm">{error}</AlertDescription>
            </Alert>
          )}
          {step === "code" && code && (
            <Box>
              <OrderedList fontSize="sm" color={muted} spacing={1} mb={4}>
                <ListItem>Install RoninArc on your Android phone (the download is on the RoninArc website).</ListItem>
                <ListItem>Open it and tap Scan code from your PC.</ListItem>
                <ListItem>Point the camera at this code, or tap Enter code and type the numbers.</ListItem>
              </OrderedList>
              <Flex direction="column" align="center" gap={3}>
                <Box bg={qrBg} p={2} borderRadius="lg" opacity={expired ? 0.25 : 1}>
                  <Image src={code.qr} alt={`QR code for the link code ${spaced(code.code)}`} w="220px" h="220px" />
                </Box>
                <Text fontSize="3xl" fontWeight="bold" letterSpacing="0.15em" fontFamily="mono" aria-label={`Code ${code.code.split("").join(" ")}`}>
                  {spaced(code.code)}
                </Text>
                <Text fontSize="sm" color={muted} aria-live="polite">
                  {expired ? "This code has expired." : `Works once, for ${left(code.expiresAt, now)}.`}
                </Text>
              </Flex>
            </Box>
          )}
        </ModalBody>
        <ModalFooter gap={2}>
          {(step === "error" || (step === "code" && expired)) && (
            <Button size="sm" colorScheme="purple" onClick={() => void makeCode()}>
              {step === "error" ? "Try again" : "New code"}
            </Button>
          )}
          {step === "code" && !expired && (
            <Button size="sm" variant="ghost" onClick={() => void makeCode()}>
              New code
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onClose}>
            Done
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
