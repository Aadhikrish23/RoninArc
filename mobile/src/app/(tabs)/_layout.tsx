import { View, type ColorValue } from "react-native";
import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/ui/theme";

// The active tab sits in a filled purple pill, like the active page in the desktop's top nav.
// The pill has a fixed size and the icon box is sized to hold it: on a phone the tab bar puts each
// icon in a small fixed box, and a pill made of padding squeezed the icon out of sight.
const PILL = { width: 56, height: 32 };

function TabIcon({ name, color, focused }: { name: keyof typeof Feather.glyphMap; color: ColorValue; focused: boolean }) {
  const c = useColors();
  return (
    <View style={{ ...PILL, borderRadius: PILL.height / 2, alignItems: "center", justifyContent: "center", backgroundColor: focused ? c.accentFill : "transparent" }}>
      <Feather name={name} size={20} color={focused ? c.onAccentFill : (color as string)} />
    </View>
  );
}

function icon(name: keyof typeof Feather.glyphMap) {
  const Icon = ({ color, focused }: { color: ColorValue; focused: boolean }) => <TabIcon name={name} color={color} focused={focused} />;
  Icon.displayName = `TabIcon(${name})`;
  return Icon;
}

export default function TabsLayout() {
  const c = useColors();
  // Room for Android's gesture bar / iPhone's home indicator under the labels.
  const { bottom } = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: { backgroundColor: c.card, borderTopColor: c.border, height: 66 + bottom, paddingTop: 8, paddingBottom: bottom + 6 },
        tabBarIconStyle: PILL,
        tabBarLabelStyle: { fontWeight: "600", fontSize: 11, marginTop: 4 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Library", tabBarAccessibilityLabel: "Library", tabBarIcon: icon("book-open") }} />
      <Tabs.Screen name="assistant" options={{ title: "Assistant", tabBarAccessibilityLabel: "Assistant", tabBarIcon: icon("message-circle") }} />
      <Tabs.Screen name="dashboard" options={{ title: "Dashboard", tabBarAccessibilityLabel: "Dashboard", tabBarIcon: icon("bar-chart-2") }} />
      <Tabs.Screen name="settings" options={{ title: "Settings", tabBarAccessibilityLabel: "Settings", tabBarIcon: icon("settings") }} />
    </Tabs>
  );
}
