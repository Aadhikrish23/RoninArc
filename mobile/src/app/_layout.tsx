import { useEffect } from "react";
import { useColorScheme } from "react-native";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "@/auth/AuthProvider";
import { queryClient } from "@/data/queryClient";
import { useColors } from "@/ui/theme";
import { applyOrientationPolicy } from "@/ui/orientation";

SplashScreen.preventAutoHideAsync();


function Routes() {
  const { ready, user } = useAuth();
  const c = useColors();
  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);
  useEffect(applyOrientationPolicy, []);
  if (!ready) return null;

  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: c.bg }, headerTintColor: c.text, headerShadowVisible: false, contentStyle: { backgroundColor: c.bg } }}>
      <Stack.Protected guard={!!user}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="game/[id]" options={{ title: "" }} />
        <Stack.Screen name="assistant" options={{ headerShown: false, presentation: "modal", animation: "slide_from_bottom" }} />
        <Stack.Screen name="games" options={{ headerShown: false }} />
        <Stack.Screen name="add" options={{ title: "Add a game", presentation: "modal" }} />
        <Stack.Screen name="collection/[id]" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        <Stack.Screen name="sign-up" options={{ headerShown: false }} />
        <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const scheme = useColorScheme();
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ThemeProvider value={scheme === "light" ? DefaultTheme : DarkTheme}>
            <StatusBar style={scheme === "light" ? "dark" : "light"} />
            <Routes />
          </ThemeProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
