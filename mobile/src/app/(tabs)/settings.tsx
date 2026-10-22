import { useState } from "react";
import { Alert, Linking, View } from "react-native";
import Constants from "expo-constants";
import { api, CLOUD_URL } from "@/api/client";
import { useAuth } from "@/auth/AuthProvider";
import { Button, Card, Field, Heading, Screen, SectionTitle, T } from "@/ui/components";
import { space } from "@/ui/theme";

export default function Settings() {
  const { user, signOut } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState<"password" | "out" | "delete" | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const changePassword = async () => {
    setBusy("password");
    setMessage(null);
    try {
      await api("/auth/change-password", { method: "PATCH", body: { currentPassword: current, newPassword: next } });
      // Every device is signed out on a password change, this one included.
      Alert.alert("Password changed", "Sign in again with your new password. Your PC asks for it the next time it syncs.");
      await signOut();
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : "Couldn't change the password.", ok: false });
    } finally {
      setBusy(null);
    }
  };

  const deleteAccount = () => {
    Alert.alert("Delete your account?", "This deletes your RoninArc account and library everywhere, including on PCs that sync with it. It can't be undone.", [
      { text: "Keep it", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setBusy("delete");
          try {
            await api("/auth/account", { method: "DELETE", body: { password: deletePassword } });
            await signOut();
          } catch (e) {
            setDeleteError(e instanceof Error ? e.message : "Couldn't delete the account.");
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  };

  return (
    <Screen>
      <Heading>Settings</Heading>

      <SectionTitle title="Account" />
      <Card style={{ gap: space.md }}>
        <View style={{ gap: 2 }}>
          <T weight="600">{user?.name}</T>
          {user?.email ? (
            <T tone="muted" size="sm">
              {user.email}
            </T>
          ) : null}
        </View>
        <Button title="Sign out" variant="outline" loading={busy === "out"} onPress={() => (setBusy("out"), signOut().finally(() => setBusy(null)))} />
      </Card>

      <SectionTitle title="Change password" />
      <Card style={{ gap: space.md }}>
        <Field label="Current password" value={current} onChangeText={setCurrent} secureTextEntry autoComplete="current-password" />
        <Field label="New password" value={next} onChangeText={setNext} secureTextEntry autoComplete="new-password" hint="At least 6 characters. Signs you out everywhere." />
        {message ? (
          <T tone={message.ok ? "success" : "danger"} size="sm">
            {message.text}
          </T>
        ) : null}
        <Button title="Change password" variant="outline" disabled={!current || next.length < 6} loading={busy === "password"} onPress={changePassword} />
      </Card>

      <SectionTitle title="Your PC" />
      <Card style={{ gap: space.sm }}>
        <T size="sm" tone="muted">
          To use this library on your PC, open RoninArc there, go to Settings, RoninArc Cloud, and choose "I already have one". It keeps working offline on the PC and syncs when it's online.
        </T>
      </Card>

      <SectionTitle title="Delete account" />
      <Card style={{ gap: space.md }}>
        <Field label="Password" value={deletePassword} onChangeText={setDeletePassword} secureTextEntry autoComplete="current-password" hint="Deletes your account and library everywhere." />
        {deleteError ? (
          <T tone="danger" size="sm">
            {deleteError}
          </T>
        ) : null}
        <Button title="Delete account" variant="danger" disabled={!deletePassword} loading={busy === "delete"} onPress={deleteAccount} />
      </Card>

      <T size="xs" tone="faint" style={{ marginTop: space.xl, textAlign: "center" }} onLongPress={() => Linking.openURL(`${CLOUD_URL}/health`)}>
        RoninArc {Constants.expoConfig?.version ?? ""}
      </T>
    </Screen>
  );
}
