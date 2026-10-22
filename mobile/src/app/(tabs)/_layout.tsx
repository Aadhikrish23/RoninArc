import type { ColorValue } from "react-native";
import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/ui/theme";

const icon =
  (name: keyof typeof Feather.glyphMap) =>
  ({ color, size }: { color: ColorValue; size: number }) => <Feather name={name} color={color as string} size={size} />;

export default function TabsLayout() {
  const c = useColors();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.faint,
        tabBarStyle: { backgroundColor: c.card, borderTopColor: c.border },
        tabBarLabelStyle: { fontWeight: "600" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Library", tabBarIcon: icon("book-open") }} />
      <Tabs.Screen name="assistant" options={{ title: "Assistant", tabBarIcon: icon("message-circle") }} />
      <Tabs.Screen name="dashboard" options={{ title: "Dashboard", tabBarIcon: icon("bar-chart-2") }} />
      <Tabs.Screen name="settings" options={{ title: "Settings", tabBarIcon: icon("settings") }} />
    </Tabs>
  );
}
