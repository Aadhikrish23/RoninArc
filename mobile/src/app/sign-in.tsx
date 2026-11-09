import { useRef, useState, type ComponentRef } from "react";
import { Pressable, View, TextInput } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/auth/AuthProvider";
import { Button, Field, T } from "@/ui/components";
import { AuthShell, WakingNote } from "@/ui/AuthShell";
import { space } from "@/ui/theme";

export default function SignIn() {
  const { signIn } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [waking, setWaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);

  const submit = async () => {
    if (!username.trim() || !password) return setError("Enter your username (or email) and password.");
    setBusy(true);
    setError(null);
    try {
      await signIn(username, password, () => setWaking(true));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't sign in.");
    } finally {
      setBusy(false);
      setWaking(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back, Ronin"
      footer={
        <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: space.xs }}>
          <T size="sm" style={{ color: "#A0AEC0" }}>
            {"Don't have an account?"}
          </T>
          <Pressable accessibilityRole="link" accessibilityLabel="Sign up" onPress={() => router.push("/sign-up")} hitSlop={8}>
            <T size="sm" weight="600" style={{ color: "#B794F4" }}>
              Sign up
            </T>
          </Pressable>
        </View>
      }
    >
      <Button title="Scan code from your PC" icon="maximize" variant="outline" onPress={() => router.push("/link-with-pc")} accessibilityLabel="Scan the code shown by RoninArc on your PC" />
      <T size="xs" style={{ color: "#A0AEC0", textAlign: "center", marginTop: -space.xs }}>
        On your PC: Settings → RoninArc Cloud → Connect your phone. No password needed.
      </T>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <View style={{ flex: 1, height: 1, backgroundColor: "#4A5568" }} />
        <T size="xs" style={{ color: "#A0AEC0" }}>
          or sign in
        </T>
        <View style={{ flex: 1, height: 1, backgroundColor: "#4A5568" }} />
      </View>
      <Field label="Username or email" placeholder="Enter your username or email" value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} autoComplete="username" textContentType="username" keyboardType="email-address" returnKeyType="next" onSubmitEditing={() => passwordRef.current?.focus()} />
      <Field ref={passwordRef} label="Password" placeholder="Enter your password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" textContentType="password" returnKeyType="go" onSubmitEditing={submit} />
      <Pressable accessibilityRole="link" accessibilityLabel="Forgot password?" onPress={() => router.push("/forgot-password")} hitSlop={8} style={{ alignSelf: "flex-end", marginTop: -space.sm }}>
        <T size="sm" style={{ color: "#B794F4" }}>
          Forgot password?
        </T>
      </Pressable>
      {waking ? <WakingNote /> : null}
      {error ? (
        <T tone="danger" size="sm" accessibilityLiveRegion="polite">
          {error}
        </T>
      ) : null}
      <Button title={waking ? "Waking up RoninArc" : "Log in"} onPress={submit} loading={busy} variant="brand" />
    </AuthShell>
  );
}
