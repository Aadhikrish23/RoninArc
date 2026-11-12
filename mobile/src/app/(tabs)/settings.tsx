import { useState } from "react";
import { Alert, Linking, View } from "react-native";
import { router } from "expo-router";
import Constants from "expo-constants";
import { api, CLOUD_URL } from "@/api/client";
import { useAuth } from "@/auth/AuthProvider";
import { Button, Field, PageHeader, Screen, T } from "@/ui/components";
import { SettingsNote, SettingsPanel, SettingsRow, SettingsSection, StatusDot } from "@/ui/settings";
import { space, useColors } from "@/ui/theme";

/** The version of this build (app.config.ts `version`, which each release sets). */
const VERSION = Constants.expoConfig?.version ?? "";

function Avatar({ name }: { name: string }) {
  const c = useColors();
  return (
    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.accentSoft, alignItems: "center", justifyContent: "center" }} accessibilityElementsHidden>
      <T weight="700" tone="accent">
        {name.slice(0, 1).toUpperCase()}
      </T>
    </View>
  );
}

export default function Settings() {
  const { user, signOut } = useAuth();
  const [busy, setBusy] = useState<"password" | "out" | "delete" | null>(null);
  const [changing, setChanging] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const name = user?.name ?? "";

  const changePassword = async () => {
    if (next !== confirm) return setPasswordError("The new passwords don't match.");
    setBusy("password");
    setPasswordError(null);
    try {
      await api("/auth/change-password", { method: "PATCH", body: { currentPassword: current, newPassword: next } });
      // Every device is signed out on a password change, this one included.
      Alert.alert("Password changed", "Sign in again with your new password. Your PC asks for it the next time it syncs.");
      await signOut();
    } catch (e) {
      setPasswordError(e instanceof Error ? e.message : "Couldn't change the password.");
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
          setDeleteError(null);
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
      <PageHeader title="Settings" subtitle="Your account, this phone's link to your PC, and this copy of RoninArc." />

      <SettingsSection title="Account">
        <SettingsPanel>
          <SettingsRow
            lead={<Avatar name={name} />}
            label={name}
            detail={user?.email ? `${user.email} · Signed in on this phone` : "Signed in on this phone"}
            actions={<Button title="Log out" size="sm" variant="outline" loading={busy === "out"} onPress={() => (setBusy("out"), signOut().finally(() => setBusy(null)))} />}
          />
        </SettingsPanel>
      </SettingsSection>

      <SettingsSection title="RoninArc Cloud" description="This phone and RoninArc on your PC share one library. Each keeps working offline and catches up when it's online.">
        <SettingsPanel>
          <SettingsRow
            label={`Syncing as ${user?.email ?? name}`}
            status={<StatusDot tone="ok">On</StatusDot>}
            detail={user?.via === "code" ? "Connected with a code from your PC." : "Signed in with your password."}
          />
          <SettingsRow
            label="Your PC"
            detail={`On a PC, open RoninArc and sign in with ${user?.email ?? "your email"} with "Sync with my other devices" ticked. Already syncing there? Connect your phone shows a code that signs a phone in.`}
            actions={<Button title="Use a code from a PC" size="sm" variant="outline" icon="maximize" onPress={() => router.push("/connect")} />}
          />
        </SettingsPanel>
      </SettingsSection>

      <SettingsSection title="Security">
        <SettingsPanel>
          <SettingsRow
            label="Password"
            detail="Changing it signs you out everywhere, this phone included."
            actions={changing ? undefined : <Button title="Change password" size="sm" variant="outline" onPress={() => setChanging(true)} />}
          >
            {changing ? (
              <View style={{ gap: space.md }}>
                <Field label="Current password" value={current} onChangeText={setCurrent} secureTextEntry autoComplete="current-password" />
                <Field label="New password" value={next} onChangeText={setNext} secureTextEntry autoComplete="new-password" hint="At least 8 characters." />
                <Field label="Confirm password" value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="new-password" />
                {passwordError ? (
                  <T tone="danger" size="sm" accessibilityLiveRegion="polite">
                    {passwordError}
                  </T>
                ) : null}
                <View style={{ flexDirection: "row", gap: space.sm, flexWrap: "wrap" }}>
                  <Button title="Change password" size="sm" variant="solid" disabled={!current || next.length < 8 || !confirm} loading={busy === "password"} onPress={changePassword} />
                  <Button
                    title="Cancel"
                    size="sm"
                    variant="ghost"
                    onPress={() => {
                      setChanging(false);
                      setCurrent("");
                      setNext("");
                      setConfirm("");
                      setPasswordError(null);
                    }}
                  />
                </View>
              </View>
            ) : null}
          </SettingsRow>
        </SettingsPanel>
      </SettingsSection>

      <SettingsSection title="Delete account">
        <SettingsPanel danger>
          <SettingsRow
            label="Delete your RoninArc account"
            detail="Permanently removes your account, library, reviews, collections and activity history, on every device that syncs with it. This can't be undone."
            actions={deleting ? undefined : <Button title="Delete account…" size="sm" variant="danger" onPress={() => setDeleting(true)} />}
          >
            {deleting ? (
              <View style={{ gap: space.md }}>
                <Field label="Confirm password" value={deletePassword} onChangeText={setDeletePassword} secureTextEntry autoComplete="current-password" />
                {deleteError ? (
                  <T tone="danger" size="sm" accessibilityLiveRegion="polite">
                    {deleteError}
                  </T>
                ) : null}
                <View style={{ flexDirection: "row", gap: space.sm, flexWrap: "wrap" }}>
                  <Button title="Delete account" size="sm" variant="dangerSolid" disabled={!deletePassword} loading={busy === "delete"} onPress={deleteAccount} />
                  <Button title="Cancel" size="sm" variant="ghost" onPress={() => (setDeleting(false), setDeletePassword(""), setDeleteError(null))} />
                </View>
              </View>
            ) : null}
          </SettingsRow>
        </SettingsPanel>
      </SettingsSection>

      <SettingsNote>
        <T size="xs" tone="faint" onLongPress={() => Linking.openURL(`${CLOUD_URL}/health`)}>
          {`RoninArc ${VERSION}. Game data from IGDB.com.`}
        </T>
      </SettingsNote>
    </Screen>
  );
}
