import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import {
  Alert,
  AlertDescription,
  AlertIcon,
  Button,
  ButtonGroup,
  FormControl,
  FormLabel,
  HStack,
  Input,
  Stack,
  Text,
  useColorModeValue,
  useToast,
} from "@chakra-ui/react";
import { FiCloud } from "react-icons/fi";

import SettingsCard from "./SettingsCard";
import syncApi, { type SyncStatus } from "../api/syncApi";
import { useAuth } from "../../auth/context/AuthContext";
import { getErrorMessage } from "../../../shared/utils/error";

function ago(iso: string | null): string {
  if (!iso) return "not yet";
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} h ago` : new Date(iso).toLocaleDateString();
}

type Mode = "create" | "signin";

/**
 * RoninArc Cloud: this PC's library syncs with the account the phone app uses. Everything
 * keeps working offline; changes go up when there's internet.
 */
export default function CloudSyncSection() {
  const { user, login } = useAuth();
  const toast = useToast();
  const muted = useColorModeValue("gray.600", "gray.400");

  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [mode, setMode] = useState<Mode | null>(null);
  const [username, setUsername] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState<"link" | "sync" | "unlink" | "reconnect" | null>(null);
  const [confirmUnlink, setConfirmUnlink] = useState(false);

  const refresh = useCallback(() => syncApi.status().then(setStatus).catch(() => {}), []);
  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 30_000);
    return () => clearInterval(timer);
  }, [refresh]);

  if (!status || !status.available) return null;

  const fail = (title: string, error: unknown) => toast({ title, description: getErrorMessage(error), status: "error", duration: 8000, isClosable: true });

  /** Nothing to fill in, unless the cloud can't take this PC's details as they are. */
  const syncToCloud = async (details: { username?: string; email?: string } = {}) => {
    setBusy("link");
    setProblem(null);
    try {
      setStatus(await syncApi.link({ mode: "create", ...details }));
      setMode(null);
      toast({
        title: "Your library is in the cloud",
        description: "On your phone, sign in with your RoninArc username and password.",
        status: "success",
        duration: 6000,
      });
    } catch (error) {
      const code = axios.isAxiosError(error) ? error.response?.status : undefined;
      if (code === 400 || code === 409) {
        const message = getErrorMessage(error);
        setProblem(message);
        // A taken name may well be theirs (say, after "Stop syncing"), so offer to sign in to it.
        setMode(/name/i.test(message) ? "signin" : "create");
      } else {
        fail("Couldn't sync to the cloud", error);
      }
    } finally {
      setBusy(null);
    }
  };

  const signIn = async () => {
    setBusy("link");
    setProblem(null);
    try {
      const result = await syncApi.link({ mode: "signin", username: username.trim(), password });
      if (result.moved && result.session) {
        // This PC's account took the cloud account's id: carry on signed in as it.
        const rememberMe = !!localStorage.getItem("roninarc_refresh_token");
        login({ name: result.cloudUsername ?? username.trim().toLowerCase(), email: user?.email }, result.session.accessToken, result.session.refreshToken, rememberMe);
      }
      setStatus(result);
      setMode(null);
      setPassword("");
      toast({
        title: "Signed in to RoninArc Cloud",
        description: "Your library now syncs with the RoninArc app on your phone.",
        status: "success",
        duration: 6000,
      });
    } catch (error) {
      fail("Couldn't sign in to RoninArc Cloud", error);
    } finally {
      setBusy(null);
    }
  };

  const switchMode = (next: Mode | null) => {
    setMode(next);
    setProblem(null);
    setPassword("");
  };

  const run = async (kind: "sync" | "unlink" | "reconnect", call: () => Promise<SyncStatus>, done?: string) => {
    setBusy(kind);
    try {
      setStatus(await call());
      if (done) toast({ title: done, status: "success", duration: 4000 });
    } catch (error) {
      fail("That didn't work", error);
    } finally {
      setBusy(null);
    }
  };

  const waiting = status.pending.changes + status.pending.deletes;

  return (
    <SettingsCard title="RoninArc Cloud" icon={FiCloud} description="Sync your library with the RoninArc app on your phone. It keeps working offline here.">
      {status.linked ? (
        <Stack spacing={4}>
          <Stack spacing={1}>
            <Text fontWeight="medium">Syncing as {status.cloudUsername}</Text>
            <Text fontSize="sm" color={muted} aria-live="polite">
              Last synced {ago(status.lastSyncAt)}
              {waiting > 0 ? ` · ${waiting} ${waiting === 1 ? "change" : "changes"} waiting to go up` : ""}
            </Text>
          </Stack>

          {status.needsSignIn ? (
            <Stack spacing={3}>
              <Alert status="warning" borderRadius="md">
                <AlertIcon />
                <AlertDescription fontSize="sm">Your RoninArc Cloud password changed. Sign in again to keep syncing.</AlertDescription>
              </Alert>
              <FormControl>
                <FormLabel fontSize="sm">Cloud password</FormLabel>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
              </FormControl>
              <Button
                colorScheme="purple"
                alignSelf="flex-start"
                isLoading={busy === "reconnect"}
                isDisabled={!password}
                onClick={() => run("reconnect", () => syncApi.reconnect(password).finally(() => setPassword("")), "Syncing again")}
              >
                Sign in again
              </Button>
            </Stack>
          ) : (
            status.lastError && (
              <Alert status="info" borderRadius="md">
                <AlertIcon />
                <AlertDescription fontSize="sm">{status.lastError} Your changes are saved here and go up later.</AlertDescription>
              </Alert>
            )
          )}

          {confirmUnlink ? (
            <Stack spacing={2}>
              <Text fontSize="sm">Stop syncing this PC? Your library stays here, and the cloud keeps its copy.</Text>
              <ButtonGroup spacing={3}>
                <Button
                  colorScheme="purple"
                  isLoading={busy === "unlink"}
                  onClick={() => run("unlink", syncApi.unlink, "Stopped syncing").finally(() => setConfirmUnlink(false))}
                >
                  Stop syncing
                </Button>
                <Button variant="ghost" onClick={() => setConfirmUnlink(false)}>
                  Keep syncing
                </Button>
              </ButtonGroup>
            </Stack>
          ) : (
            <HStack spacing={3} wrap="wrap">
              <Button variant="outline" isLoading={busy === "sync"} loadingText="Syncing" onClick={() => run("sync", syncApi.syncNow)}>
                Sync now
              </Button>
              <Button variant="ghost" onClick={() => setConfirmUnlink(true)}>
                Stop syncing
              </Button>
            </HStack>
          )}
        </Stack>
      ) : mode ? (
        <Stack spacing={3}>
          {problem && (
            <Alert status="warning" borderRadius="md">
              <AlertIcon />
              <AlertDescription fontSize="sm">{problem}</AlertDescription>
            </Alert>
          )}
          <Text fontSize="sm" color={muted}>
            {mode === "create"
              ? "Your password stays the same. Use these details to sign in on your phone."
              : "If this account is yours, sign in and your library here merges into it: games you have on both are kept once, with your notes and reviews from both."}
          </Text>
          <FormControl>
            <FormLabel fontSize="sm">Cloud username</FormLabel>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
          </FormControl>
          {mode === "create" ? (
            <FormControl>
              <FormLabel fontSize="sm">Email</FormLabel>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              <Text fontSize="xs" color={muted} mt={1}>
                Only for resetting a forgotten password.
              </Text>
            </FormControl>
          ) : (
            <FormControl>
              <FormLabel fontSize="sm">Password</FormLabel>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </FormControl>
          )}
          <ButtonGroup spacing={3} flexWrap="wrap">
            {mode === "create" ? (
              <Button
                colorScheme="purple"
                isLoading={busy === "link"}
                loadingText="Syncing your library"
                isDisabled={!username.trim() || !email.trim()}
                onClick={() => syncToCloud({ username: username.trim(), email: email.trim() })}
              >
                Sync to cloud
              </Button>
            ) : (
              <Button
                colorScheme="purple"
                isLoading={busy === "link"}
                loadingText="Merging your library"
                isDisabled={!username.trim() || !password}
                onClick={signIn}
              >
                Sign in and sync
              </Button>
            )}
            <Button variant="ghost" onClick={() => switchMode(mode === "create" ? "signin" : "create")}>
              {mode === "create" ? "I already have a cloud account" : "Use a different name"}
            </Button>
            <Button variant="ghost" onClick={() => switchMode(null)}>
              Cancel
            </Button>
          </ButtonGroup>
        </Stack>
      ) : (
        <Button
          colorScheme="purple"
          alignSelf="flex-start"
          isLoading={busy === "link"}
          loadingText="Syncing your library"
          onClick={() => syncToCloud()}
        >
          Sync to cloud
        </Button>
      )}
    </SettingsCard>
  );
}
