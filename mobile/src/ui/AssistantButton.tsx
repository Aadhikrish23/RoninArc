import { useEffect, useState } from "react";
import { Keyboard, Pressable } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

/**
 * The desktop's assistant launcher, on the phone: a 56px purple circle with sparkles, floating in
 * the bottom-right corner above the tab bar. It opens the assistant over whatever screen you're on.
 * Hidden while the keyboard is up, so it never sits on a field you're typing in.
 */
export function AssistantButton({ bottom }: { bottom: number }) {
  const [keyboard, setKeyboard] = useState(false);
  useEffect(() => {
    const shown = Keyboard.addListener("keyboardDidShow", () => setKeyboard(true));
    const hidden = Keyboard.addListener("keyboardDidHide", () => setKeyboard(false));
    return () => (shown.remove(), hidden.remove());
  }, []);
  if (keyboard) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open AI Assistant"
      onPress={() => router.push("/assistant")}
      style={({ pressed }) => ({
        position: "absolute",
        right: 20,
        bottom,
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: pressed ? "#6B46C1" : "#805AD5",
        transform: [{ scale: pressed ? 0.95 : 1 }],
        // Chakra's "xl" shadow on the desktop button.
        boxShadow: "0 10px 15px -3px rgba(0,0,0,0.25), 0 4px 6px -2px rgba(0,0,0,0.12)",
      })}
    >
      <Ionicons name="sparkles-outline" size={26} color="#FFFFFF" />
    </Pressable>
  );
}
