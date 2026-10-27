import { Dimensions, Platform } from "react-native";

/**
 * Phones stay portrait; a tablet (shortest side 600dp or more) turns with the device, so it isn't a
 * phone-shaped strip with black bars when held in landscape.
 *
 * Called from an effect once the app is running, and the module is loaded only then: importing and
 * calling it at the top of the root layout ran before Expo's native runtime was ready and crashed
 * the app on start ("Cannot read property 'EventEmitter' of undefined").
 */
export function applyOrientationPolicy() {
  if (Platform.OS === "web") return;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ScreenOrientation = require("expo-screen-orientation") as typeof import("expo-screen-orientation");
  const { width, height } = Dimensions.get("screen");
  const lock = Math.min(width, height) < 600 ? ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP) : ScreenOrientation.unlockAsync();
  lock.catch(() => {});
}
