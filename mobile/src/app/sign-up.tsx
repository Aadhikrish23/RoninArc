import { useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/auth/AuthProvider";
import { Button, Field, T } from "@/ui/components";
import { AuthShell } from "@/ui/AuthShell";
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
    <AuthShell
      title="Welcome, Ronin"
      footer={
        <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: space.xs }}>
          <T size="sm" style={{ color: "#A0AEC0" }}>
            Already have an account?
          </T>
          <Pressable accessibilityRole="link" accessibilityLabel="Log in" onPress={() => (router.canGoBack() ? router.back() : router.replace("/sign-in"))} hitSlop={8}>
            <T size="sm" weight="600" style={{ color: "#B794F4" }}>
              Log in
            </T>
          </Pressable>
        </View>
      }
    >
      <Field label="Username" placeholder="Enter your username" value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} autoComplete="username-new" />
      <Field label="Email" placeholder="Enter your email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" hint="Only for resetting a forgotten password." />
      <Field label="Password" placeholder="Enter your password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" hint="At least 6 characters." />
      {error ? (
        <T tone="danger" size="sm" accessibilityLiveRegion="polite">
          {error}
        </T>
      ) : null}
      <Button title="Create account" onPress={submit} loading={busy} variant="brand" />
      <T size="xs" style={{ color: "#A0AEC0", textAlign: "center" }}>
        Already use RoninArc on your PC? Sign in there with this account under Settings → RoninArc Cloud, and your library syncs.
      </T>
    </AuthShell>
  );
}
