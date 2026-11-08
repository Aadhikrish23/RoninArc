import { useEffect, useState } from "react";
import { Button, Text, useToast } from "@chakra-ui/react";

import { SettingsNote, SettingsPanel, SettingsRow, SettingsSection } from "./SettingsLayout";

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

  const credit = (
    <SettingsNote>
      Game data from{" "}
      <Text as="a" href="https://www.igdb.com" target="_blank" rel="noreferrer" textDecoration="underline" textUnderlineOffset="3px">
        IGDB.com
      </Text>
      .
    </SettingsNote>
  );

  return (
    <SettingsSection id="about" title="About and support">
      <SettingsPanel>
        {desktop ? (
          <>
            <SettingsRow
              label={`RoninArc ${version ?? ""}`.trim()}
              detail={<span aria-live="polite">{describe(update)}</span>}
              actions={
                update?.state === "ready" ? (
                  <Button size="sm" colorScheme="purple" onClick={() => api?.installUpdate?.()}>
                    Restart to update
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={check}
                    isLoading={checking}
                    isDisabled={update?.state === "disabled" || update?.state === "downloading"}
                  >
                    Check for updates
                  </Button>
                )
              }
            />
            <SettingsRow
              label="Problem report"
              detail="Saves a zip to your Desktop to send along with what you were doing. It holds RoninArc's recent logs, which include your recent AI messages and game names. Passwords, tokens and keys are removed."
              actions={
                <Button size="sm" variant="outline" onClick={report} isLoading={reporting} loadingText="Creating report">
                  Create problem report
                </Button>
              }
            />
          </>
        ) : (
          <SettingsRow label="RoninArc" detail="Updates and problem reports are in the RoninArc desktop app." />
        )}
        {credit}
      </SettingsPanel>
    </SettingsSection>
  );
}
