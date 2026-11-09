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
import { SettingsPanel, SettingsRow, SettingsSection, StatusDot } from "./SettingsLayout";
import syncApi, { type SyncStatus } from "../api/syncApi";
import ConnectPhoneModal from "./ConnectPhoneModal";
import { setSyncPreference } from "../syncOtherDevices";
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
  const [phoneOpen, setPhoneOpen] = useState(false);

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
  const attention = !status.linked ? status.autoLink : null;

  // "Not now" on a sign-in that asked to sync: stop trying, and untick the box next time.
  const notNow = () => run("unlink", async () => {
    setSyncPreference(false);
    return syncApi.dropAutoLink();
  });

  const syncNow = (
    <Button size="sm" variant="outline" isLoading={busy === "sync"} loadingText="Syncing" onClick={() => run("sync", syncApi.syncNow)}>
      Sync now
    </Button>
  );
  const stopSyncing = (
    <Button size="sm" variant="ghost" color={muted} onClick={() => setConfirmUnlink(true)}>
      Stop syncing
    </Button>
  );

  return (
    <SettingsSection id="cloud" title="RoninArc Cloud" description="Sync your library with the RoninArc app on your phone. Everything keeps working offline here.">
      <SettingsPanel>
        {status.linked ? (
          <SettingsRow
            label={`Syncing as ${status.cloudUsername}`}
            status={status.needsSignIn ? <StatusDot tone="warn">Paused</StatusDot> : <StatusDot tone="ok">On</StatusDot>}
            detail={
              <span aria-live="polite">
                Last synced {ago(status.lastSyncAt)}
                {waiting > 0 ? ` · ${waiting} ${waiting === 1 ? "change" : "changes"} waiting to go up` : ""}
              </span>
            }
            actions={confirmUnlink ? undefined : status.needsSignIn ? stopSyncing : <>{syncNow}{stopSyncing}</>}
          >
            {status.needsSignIn ? (
              <Stack spacing={3} mt={4}>
                <Alert status="warning" borderRadius="md">
                  <AlertIcon />
                  <AlertDescription fontSize="sm">Your RoninArc Cloud password changed. Sign in again to keep syncing.</AlertDescription>
                </Alert>
                <HStack align="flex-end" spacing={2} flexWrap="wrap">
                  <FormControl maxW="320px">
                    <FormLabel fontSize="sm">Cloud password</FormLabel>
                    <Input size="sm" borderRadius="md" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
                  </FormControl>
                  <Button
                    size="sm"
                    colorScheme="purple"
                    isLoading={busy === "reconnect"}
                    isDisabled={!password}
                    onClick={() => run("reconnect", () => syncApi.reconnect(password).finally(() => setPassword("")), "Syncing again")}
                  >
                    Sign in again
                  </Button>
                </HStack>
              </Stack>
            ) : (
              status.lastError && (
                <Alert status="info" borderRadius="md" mt={4}>
                  <AlertIcon />
                  <AlertDescription fontSize="sm">{status.lastError} Your changes are saved here and go up later.</AlertDescription>
                </Alert>
              )
            )}
          </SettingsRow>
        ) : attention?.attention && !mode ? (
          // Ticked "Sync with my other devices", but the cloud said no: say why and offer the way out.
          <SettingsRow
            label="Sync needs your attention"
            status={<StatusDot tone="warn">Not syncing yet</StatusDot>}
            detail={
              attention.attention === "name-taken"
                ? `Someone else already uses "${user?.name ?? "this name"}" in RoninArc Cloud. Choose another name for syncing; you keep signing in here as you do now. If that cloud account is yours, sign in to it instead.`
                : `${attention.message ?? "Couldn't turn on sync."}`
            }
            actions={
              <Button size="sm" variant="ghost" color={muted} isLoading={busy === "unlink"} onClick={notNow}>
                Not now
              </Button>
            }
          >
            <HStack mt={3} spacing={2} flexWrap="wrap">
              {attention.attention === "name-taken" &&
                attention.suggestions.map((s) => (
                  <Button key={s} size="sm" colorScheme="purple" variant="outline" isLoading={busy === "link"} onClick={() => syncToCloud({ username: s })}>
                    Sync as {s}
                  </Button>
                ))}
              {attention.attention === "name-taken" ? (
                <>
                  <Button size="sm" variant="ghost" onClick={() => switchMode("create")}>
                    Another name
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => switchMode("signin")}>
                    It's mine
                  </Button>
                </>
              ) : (
                // e.g. no email on this PC's account: the form asks for what's missing.
                <Button size="sm" colorScheme="purple" onClick={() => switchMode("create")}>
                  Sync to cloud
                </Button>
              )}
            </HStack>
          </SettingsRow>
        ) : (
          <SettingsRow
            label={attention?.waiting ? "Waiting for internet" : "Not syncing"}
            status={attention?.waiting ? <StatusDot tone="busy">Waiting</StatusDot> : <StatusDot tone="off">Off</StatusDot>}
            detail={
              attention?.waiting
                ? "Sync turns on by itself as soon as this PC is online. Everything works here meanwhile."
                : "Puts this library in the cloud under your RoninArc username and password, so you can sign in on your phone."
            }
            actions={
              mode ? undefined : (
                <Button size="sm" colorScheme="purple" isLoading={busy === "link"} loadingText="Syncing your library" onClick={() => syncToCloud()}>
                  Sync to cloud
                </Button>
              )
            }
          >
            {mode && (
              <Stack spacing={3} mt={4} maxW="420px">
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
                  <Input size="sm" borderRadius="md" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
                </FormControl>
                {mode === "create" ? (
                  <FormControl>
                    <FormLabel fontSize="sm">Email</FormLabel>
                    <Input size="sm" borderRadius="md" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                    <Text fontSize="xs" color={muted} mt={1}>
                      Only for resetting a forgotten password.
                    </Text>
                  </FormControl>
                ) : (
                  <FormControl>
                    <FormLabel fontSize="sm">Password</FormLabel>
                    <Input size="sm" borderRadius="md" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
                  </FormControl>
                )}
                <ButtonGroup size="sm" spacing={2} flexWrap="wrap">
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
                    <Button colorScheme="purple" isLoading={busy === "link"} loadingText="Merging your library" isDisabled={!username.trim() || !password} onClick={signIn}>
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
            )}
          </SettingsRow>
        )}
        {status.linked && confirmUnlink && (
          <SettingsRow
            highlight
            label="Stop syncing this PC?"
            detail="Your library stays here, and the cloud keeps its copy."
            actions={
              <>
                <Button size="sm" variant="ghost" onClick={() => setConfirmUnlink(false)}>
                  Keep syncing
                </Button>
                <Button
                  size="sm"
                  colorScheme="purple"
                  isLoading={busy === "unlink"}
                  onClick={() => {
                    setSyncPreference(false);
                    run("unlink", syncApi.unlink, "Stopped syncing").finally(() => setConfirmUnlink(false));
                  }}
                >
                  Stop syncing
                </Button>
              </>
            }
          />
        )}
        <SettingsRow
          label="Your phone"
          status={status.phoneLinked ? <StatusDot tone="ok">Connected</StatusDot> : <StatusDot tone="off">No phone yet</StatusDot>}
          detail={
            status.phoneLinked
              ? "A phone uses this library. Connect another one the same way."
              : "Show a code for the RoninArc phone app to scan. No password to type on the phone."
          }
          actions={
            <Button size="sm" variant={status.phoneLinked ? "outline" : "solid"} colorScheme={status.phoneLinked ? undefined : "purple"} onClick={() => setPhoneOpen(true)}>
              Connect your phone
            </Button>
          }
        />
      </SettingsPanel>
      <ConnectPhoneModal
        isOpen={phoneOpen}
        onClose={() => {
          setPhoneOpen(false);
          refresh();
        }}
        onStatus={setStatus}
      />
    </SettingsSection>
  );
}
