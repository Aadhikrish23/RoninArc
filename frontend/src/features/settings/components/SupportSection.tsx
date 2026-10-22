import { useEffect, useState } from "react";
import { Button, HStack, Stack, Text, useColorModeValue, useToast } from "@chakra-ui/react";
import { FiLifeBuoy } from "react-icons/fi";

import SettingsCard from "./SettingsCard";

type UpdateStatus = Awaited<ReturnType<NonNullable<NonNullable<Window["electronAPI"]>["checkForUpdates"]>>>;

function describe(status: UpdateStatus | null): string {
  if (!status) return "";
  switch (status.state) {
    case "disabled":
      return "Automatic updates aren't set up in this build.";
    case "checking":
      return "Checking for updates…";
    case "up-to-date":
      return "You're on the latest version.";
    case "downloading":
      return `Downloading RoninArc ${status.version ?? ""}${status.percent ? ` (${status.percent}%)` : ""}…`;
    case "ready":
      return `RoninArc ${status.version ?? ""} is ready. It installs when you restart.`;
    case "error":
      return "Couldn't check for updates. Check your internet connection and try again.";
    default:
      return "Updates are checked automatically.";
  }
}

/** Version, updates and problem reports. The desktop app only; the browser build explains that. */
export default function SupportSection() {
  const api = typeof window !== "undefined" ? window.electronAPI : undefined;
  const desktop = !!api?.createProblemReport;
  const muted = useColorModeValue("gray.600", "gray.400");
  const toast = useToast();

  const [version, setVersion] = useState<string | null>(null);
  const [update, setUpdate] = useState<UpdateStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [reporting, setReporting] = useState(false);

  useEffect(() => {
    if (!desktop) return;
    api?.getAppInfo?.().then((info) => setVersion(info.version)).catch(() => {});
    api?.getUpdateStatus?.().then(setUpdate).catch(() => {});
  }, [api, desktop]);

  // A download in progress updates itself.
  useEffect(() => {
    if (update?.state !== "downloading" && update?.state !== "checking") return;
    const timer = setInterval(() => api?.getUpdateStatus?.().then(setUpdate).catch(() => {}), 2000);
    return () => clearInterval(timer);
  }, [api, update?.state]);

  const check = async () => {
    setChecking(true);
    try {
      setUpdate((await api?.checkForUpdates?.()) ?? null);
    } finally {
      setChecking(false);
    }
  };

  const report = async () => {
    setReporting(true);
    try {
      const result = await api?.createProblemReport?.();
      if (result?.ok) {
        toast({
          title: "Problem report saved to your Desktop",
          description: "Send that zip along with what you were doing. Passwords and keys are removed from it.",
          status: "success",
          duration: 8000,
        });
      } else {
        toast({ title: "Couldn't create the report", description: result?.message, status: "error", duration: 8000 });
      }
    } finally {
      setReporting(false);
    }
  };

  return (
    <SettingsCard title="About and support" icon={FiLifeBuoy} description="Your version, updates, and a report to send when something goes wrong.">
      {desktop ? (
        <Stack spacing={4}>
          <Stack spacing={1}>
            <Text fontWeight="medium">RoninArc {version ?? ""}</Text>
            <Text fontSize="sm" color={muted} aria-live="polite">
              {describe(update)}
            </Text>
          </Stack>
          <HStack spacing={3} wrap="wrap">
            {update?.state === "ready" ? (
              <Button colorScheme="purple" onClick={() => api?.installUpdate?.()}>
                Restart to update
              </Button>
            ) : (
              <Button variant="outline" onClick={check} isLoading={checking} isDisabled={update?.state === "disabled" || update?.state === "downloading"}>
                Check for updates
              </Button>
            )}
            <Button variant="outline" onClick={report} isLoading={reporting} loadingText="Creating report">
              Create problem report
            </Button>
          </HStack>
          <Text fontSize="sm" color={muted}>
            The report holds RoninArc's recent logs, which include your recent AI messages and game names. Passwords, tokens and keys are removed.
          </Text>
        </Stack>
      ) : (
        <Text fontSize="sm" color={muted}>
          Updates and problem reports are in the RoninArc desktop app.
        </Text>
      )}
    </SettingsCard>
  );
}
