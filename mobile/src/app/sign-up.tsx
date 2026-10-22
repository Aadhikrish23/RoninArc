import { useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { Button, Card, Field, Screen, T } from "@/ui/components";
import { space } from "@/ui/theme";

export default function SignUp() {
  const { signUp } = useAuth();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (username.trim().length < 3) return setError("Use at least 3 characters for the username.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError("Enter a valid email address.");
    if (password.length < 6) return setError("Use at least 6 characters for the password.");
    setBusy(true);
    setError(null);
    try {
      await signUp(username, email, password);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create the account.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={["bottom"]}>
      <Card style={{ gap: space.lg }}>
        <Field label="Username" value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} autoComplete="username-new" />
        <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" hint="Only for resetting a forgotten password." />
        <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" hint="At least 6 characters." />
        {error ? (
          <T tone="danger" size="sm" accessibilityLiveRegion="polite">
            {error}
          </T>
        ) : null}
        <Button title="Create account" onPress={submit} loading={busy} />
        <T tone="faint" size="xs">
          Already use RoninArc on your PC? Sign in there with this account under Settings, RoninArc Cloud, and your library syncs.
        </T>
      </Card>
    </Screen>
  );
}
