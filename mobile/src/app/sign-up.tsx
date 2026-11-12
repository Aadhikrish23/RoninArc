import { useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/auth/AuthProvider";
import { Button, Field, T } from "@/ui/components";
import { AuthShell, WakingNote } from "@/ui/AuthShell";
import { space } from "@/ui/theme";

export default function SignUp() {
  const { signUp } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [waking, setWaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim()) return setError("Enter a name: it's what RoninArc calls you.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError("Enter a valid email address.");
    if (password.length < 8) return setError("Use at least 8 characters for the password.");
    setBusy(true);
    setError(null);
    try {
      await signUp(name, email, password, () => setWaking(true));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create the account.");
    } finally {
      setBusy(false);
      setWaking(false);
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
      <Field label="Name" placeholder="What should RoninArc call you?" value={name} onChangeText={setName} autoComplete="nickname" />
      <Field label="Email" placeholder="you@example.com" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" hint="You sign in with it, and it's how you reset a forgotten password." />
      <Field label="Password" placeholder="Enter your password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" hint="At least 8 characters." />
      {waking ? <WakingNote /> : null}
      {error ? (
        <T tone="danger" size="sm" accessibilityLiveRegion="polite">
          {error}
        </T>
      ) : null}
      <Button title={waking ? "Waking up RoninArc" : "Create account"} onPress={submit} loading={busy} variant="brand" />
      <T size="xs" style={{ color: "#A0AEC0", textAlign: "center" }}>
        Already use RoninArc on your PC? Go back and tap Scan code from your PC instead: your library comes along.
      </T>
    </AuthShell>
  );
}
