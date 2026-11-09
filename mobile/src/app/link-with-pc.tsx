import { useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useAuth } from "@/auth/AuthProvider";
import { Button, Field, T } from "@/ui/components";
import { AuthShell, WakingNote } from "@/ui/AuthShell";
import { space } from "@/ui/theme";

/** The six digits in a typed code ("482 913") or a scanned QR code ("roninarc://link/482913"). */
function digitsOf(text: string): string | undefined {
  const match = text.match(/(?:^|\D)(\d{3})\s?-?(\d{3})(?:\D|$)/);
  return match ? match[1] + match[2] : undefined;
}

/**
 * Sign in with the code RoninArc on the PC shows (Settings → RoninArc Cloud → Connect your phone):
 * scan its QR code, or type the six digits. No password; the phone gets the PC's library.
 */
export default function LinkWithPc() {
  const { user, signInWithCode } = useAuth();
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<"scan" | "enter">(params.mode === "enter" ? "enter" : "scan");
  const [permission, requestPermission] = useCameraPermissions();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [waking, setWaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The camera reports the same code many times a second: one try per code.
  const tried = useRef<string | null>(null);

  const submit = async (raw: string) => {
    const digits = digitsOf(raw);
    if (!digits) return setError("Enter the 6 digits shown on your PC.");
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await signInWithCode(digits, () => setWaking(true));
      router.replace("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "That code didn't work.");
    } finally {
      setBusy(false);
      setWaking(false);
    }
  };

  const onScanned = ({ data }: { data: string }) => {
    const digits = digitsOf(data);
    if (!digits || tried.current === digits) return;
    tried.current = digits;
    void submit(digits);
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace(user ? "/" : "/sign-in"));

  return (
    <AuthShell
      title="Connect to your PC"
      footer={
        <Pressable accessibilityRole="link" accessibilityLabel="Back" onPress={back} hitSlop={8} style={{ alignSelf: "center" }}>
          <T size="sm" weight="600" style={{ color: "#B794F4" }}>
            Back
          </T>
        </Pressable>
      }
    >
      <T size="sm" style={{ color: "#CBD5E0" }}>
        On your PC, open RoninArc and go to Settings → RoninArc Cloud → Connect your phone (or Show the code on the dashboard).
        {user ? " This phone then shows that PC's library instead of the one you're signed in to now." : ""}
      </T>

      {mode === "scan" ? (
        permission?.granted ? (
          <View style={{ alignSelf: "center", width: 260, height: 260, borderRadius: 12, overflow: "hidden", borderWidth: 2, borderColor: "#805AD5" }}>
            <CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={busy ? undefined : onScanned} />
          </View>
        ) : (
          <View style={{ gap: space.sm }}>
            <T size="sm" style={{ color: "#A0AEC0" }}>
              {permission && !permission.canAskAgain
                ? "Camera access is off for RoninArc. Turn it on in your phone's settings, or enter the code instead."
                : "RoninArc needs the camera only to read the code on your PC's screen."}
            </T>
            {permission?.canAskAgain !== false ? <Button title="Allow camera" icon="camera" variant="brand" onPress={() => void requestPermission()} /> : null}
          </View>
        )
      ) : (
        <Field
          label="Code from your PC"
          placeholder="123 456"
          value={code}
          onChangeText={(t) => setCode(t.replace(/[^\d ]/g, "").slice(0, 7))}
          keyboardType="number-pad"
          autoFocus
          maxLength={7}
          returnKeyType="go"
          onSubmitEditing={() => void submit(code)}
          style={{ fontSize: 24, letterSpacing: 6, textAlign: "center" }}
          hint="Works once, for 10 minutes. Make a new one on the PC if it expired."
        />
      )}

      {waking ? <WakingNote /> : null}
      {error ? (
        <T tone="danger" size="sm" accessibilityLiveRegion="polite">
          {error}
        </T>
      ) : null}

      {mode === "enter" ? <Button title="Connect" onPress={() => void submit(code)} loading={busy} variant="brand" disabled={!digitsOf(code)} /> : null}
      <Button
        title={mode === "scan" ? "Enter code instead" : "Scan the code instead"}
        icon={mode === "scan" ? "hash" : "maximize"}
        variant="outline"
        onPress={() => {
          setError(null);
          tried.current = null;
          setMode(mode === "scan" ? "enter" : "scan");
        }}
      />
    </AuthShell>
  );
}
