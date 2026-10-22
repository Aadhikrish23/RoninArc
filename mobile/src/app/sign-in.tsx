import { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, View, type TextInput } from "react-native";
import { Link } from "expo-router";
import { useAuth } from "@/auth/AuthProvider";
import { Button, Card, Field, Heading, Screen, T } from "@/ui/components";
import { space } from "@/ui/theme";

export default function SignIn() {
  const { signIn } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);

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
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen edges={["top", "bottom"]}>
        <View style={{ gap: space.xs, marginTop: space.xxl, marginBottom: space.xl }}>
          <Heading size="xxl">RoninArc</Heading>
          <T tone="muted">Your game library, on your phone. Sign in with the account you use on your PC.</T>
        </View>
        <Card style={{ gap: space.lg }}>
          <Field label="Username" value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} autoComplete="username" textContentType="username" returnKeyType="next" onSubmitEditing={() => passwordRef.current?.focus()} />
          <Field ref={passwordRef} label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" textContentType="password" returnKeyType="go" onSubmitEditing={submit} />
          {error ? (
            <T tone="danger" size="sm" accessibilityLiveRegion="polite">
              {error}
            </T>
          ) : null}
          <Button title="Sign in" onPress={submit} loading={busy} />
          <Link href="/forgot-password" asChild>
            <Button title="Forgot password?" variant="ghost" />
          </Link>
        </Card>
        <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: space.xs, marginTop: space.xl }}>
          <T tone="muted" size="sm">
            New to RoninArc?
          </T>
          <Link href="/sign-up" asChild>
            <Button title="Create an account" variant="ghost" style={{ paddingHorizontal: space.sm }} />
          </Link>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
