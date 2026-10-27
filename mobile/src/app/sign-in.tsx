import { useRef, useState, type ComponentRef } from "react";
import { Pressable, View, TextInput } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/auth/AuthProvider";
import { Button, Field, T } from "@/ui/components";
import { AuthShell } from "@/ui/AuthShell";
import { space } from "@/ui/theme";

export default function SignIn() {
  const { signIn } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);

  const submit = async () => {
    if (!username.trim() || !password) return setError("Enter your username and password.");
    setBusy(true);
    setError(null);
    try {
      await signIn(username, password);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't sign in.");
    } finally {
      setBusy(false);
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
      <Field label="Username" placeholder="Enter your username" value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} autoComplete="username" textContentType="username" returnKeyType="next" onSubmitEditing={() => passwordRef.current?.focus()} />
      <Field ref={passwordRef} label="Password" placeholder="Enter your password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" textContentType="password" returnKeyType="go" onSubmitEditing={submit} />
      <Pressable accessibilityRole="link" accessibilityLabel="Forgot password?" onPress={() => router.push("/forgot-password")} hitSlop={8} style={{ alignSelf: "flex-end", marginTop: -space.sm }}>
        <T size="sm" style={{ color: "#B794F4" }}>
          Forgot password?
        </T>
      </Pressable>
      {error ? (
        <T tone="danger" size="sm" accessibilityLiveRegion="polite">
          {error}
        </T>
      ) : null}
      <Button title="Log in" onPress={submit} loading={busy} variant="brand" />
      <T size="xs" style={{ color: "#A0AEC0", textAlign: "center" }}>
        Use the same account as RoninArc on your PC and your library comes along.
      </T>
    </AuthShell>
  );
}
