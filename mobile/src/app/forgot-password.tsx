import { useState } from "react";
import { router } from "expo-router";
import { api } from "@/api/client";
import { Button, Card, Field, Screen, T } from "@/ui/components";
import { space } from "@/ui/theme";

export default function ForgotPassword() {
  const [identifier, setIdentifier] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ Message: string }>("/auth/forgot-password", { method: "POST", body: { identifier: identifier.trim() }, auth: false });
      setSent(res?.Message ?? "If an account matches, we've emailed a link to reset its password.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send the link.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={["bottom"]}>
      <Card style={{ gap: space.lg }}>
        {sent ? (
          <>
            <T accessibilityLiveRegion="polite">{sent}</T>
            <T tone="muted" size="sm">
              Open the link on any device, set a new password, then sign in with it here.
            </T>
            <Button title="Back to sign in" onPress={() => router.back()} />
          </>
        ) : (
          <>
            <T tone="muted">We'll email you a link to set a new password.</T>
            <Field label="Email or username" value={identifier} onChangeText={setIdentifier} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" returnKeyType="send" onSubmitEditing={submit} />
            {error ? (
              <T tone="danger" size="sm">
                {error}
              </T>
            ) : null}
            <Button title="Email me a link" onPress={submit} loading={busy} disabled={!identifier.trim()} />
          </>
        )}
      </Card>
    </Screen>
  );
}
