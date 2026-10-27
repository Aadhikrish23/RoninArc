import type { ExpoConfig } from "expo/config";

/**
 * RoninArc Cloud's address, baked in at build time:
 *   RONINARC_CLOUD_URL=https://roninarc-cloud.onrender.com npx expo run:android --variant release
 * The default reaches a cloud running on this PC from the Android emulator (10.0.2.2 = the host).
 */
const cloudUrl = (process.env.RONINARC_CLOUD_URL || "http://10.0.2.2:5056").replace(/\/+$/, "");

const config: ExpoConfig = {
  name: "RoninArc",
  slug: "roninarc",
  version: "1.0.0",
  // Portrait in the config (Expo Go fell over with "default"); tablets unlock rotation at runtime
  // (src/ui/orientation.ts).
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "roninarc",
  userInterfaceStyle: "automatic",
  backgroundColor: "#171923",
  ios: { bundleIdentifier: "com.roninarc.mobile" },
  android: {
    package: "com.roninarc.mobile",
    versionCode: 1,
    adaptiveIcon: {
      backgroundColor: "#1C1C1C",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
    },
    predictiveBackGestureEnabled: false,
  },
  web: { output: "single", favicon: "./assets/images/favicon.png" },
  plugins: [
    "expo-router",
    "expo-secure-store",
    ["expo-splash-screen", { backgroundColor: "#1C1C1C", image: "./assets/images/splash-icon.png", imageWidth: 200 }],
    // Plain http is only allowed for a local test cloud; a real one is https.
    ["expo-build-properties", { android: { usesCleartextTraffic: cloudUrl.startsWith("http://") } }],
    // Keeps the native build under Windows' 260-character path limit (see the plugin).
    "./plugins/withShortCxxDir",
  ],
  experiments: { typedRoutes: true, reactCompiler: true },
  extra: { cloudUrl },
};

export default config;
