import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ForceScheme, space } from "./theme";
import { T } from "./components";

/** A soft glow: rings of the colour fading out, standing in for the desktop's radial gradient. */
function Glow({ color, size, style }: { color: string; size: number; style: object }) {
  return (
    <View pointerEvents="none" style={[{ position: "absolute", width: size, height: size, alignItems: "center", justifyContent: "center" }, style]}>
      {/* Many faint rings stacked, so the fade reads as smooth instead of banded. */}
      {Array.from({ length: 16 }, (_, i) => 1 - i * 0.055).map((f, i) => (
        <View key={i} style={{ position: "absolute", width: size * f, height: size * f, borderRadius: (size * f) / 2, backgroundColor: color, opacity: 0.035 }} />
      ))}
    </View>
  );
}

/**
 * The desktop's login, on the phone: near-black with a pink and a violet glow, and a gray.800
 * card with the crimson shadow. Always dark, whatever the phone's theme.
 */
export function AuthShell({ title, children, footer }: { title: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <ForceScheme value="dark">
      <View style={{ flex: 1, backgroundColor: "#050509", overflow: "hidden" }}>
        <Glow color="rgb(255,0,90)" size={520} style={{ top: -220, left: -200 }} />
        <Glow color="rgb(110,75,255)" size={480} style={{ bottom: -200, right: -190 }} />
        <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: space.xl }} keyboardShouldPersistTaps="handled">
              <View
                style={{
                  backgroundColor: "#1A202C",
                  borderRadius: 12,
                  padding: space.xl,
                  gap: space.lg,
                  boxShadow: "8px 8px 15px #ff004d",
                }}
              >
                <T size="xxl" weight="700" accessibilityRole="header" style={{ color: "#FFFFFF", textAlign: "center" }}>
                  {title}
                </T>
                <View style={{ height: 1, backgroundColor: "#2D3748" }} />
                {children}
              </View>
              {footer ? <View style={{ marginTop: space.xl }}>{footer}</View> : null}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </ForceScheme>
  );
}
