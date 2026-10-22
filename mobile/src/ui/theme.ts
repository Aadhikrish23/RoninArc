import { useColorScheme } from "react-native";

/**
 * The desktop app's palette (Chakra's gray and purple scales), so the phone looks like the same
 * product: purple as the one accent, status colours as on the desktop library cards.
 */
const palette = {
  light: {
    bg: "#F7FAFC", // gray.50
    card: "#FFFFFF",
    cardAlt: "#EDF2F7", // gray.100
    border: "#E2E8F0", // gray.200
    text: "#1A202C", // gray.800
    muted: "#4A5568", // gray.600
    faint: "#718096", // gray.500
    accent: "#6B46C1", // purple.600
    accentSoft: "#E9D8FD", // purple.100
    onAccent: "#FFFFFF",
    danger: "#C53030",
    success: "#2F855A",
    warning: "#B7791F",
  },
  dark: {
    bg: "#171923", // gray.900
    card: "#1A202C", // gray.800
    cardAlt: "#2D3748", // gray.700
    border: "#2D3748",
    text: "#F7FAFC",
    muted: "#A0AEC0", // gray.400
    faint: "#718096",
    accent: "#9F7AEA", // purple.400
    accentSoft: "#322659", // purple.900
    onAccent: "#FFFFFF",
    danger: "#FC8181",
    success: "#68D391",
    warning: "#F6AD55",
  },
} as const;

export type Colors = { [K in keyof (typeof palette)["dark"]]: string };

export function useColors(): Colors {
  return useColorScheme() === "light" ? palette.light : palette.dark;
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 6, md: 10, lg: 14, pill: 999 } as const;
export const font = { xs: 12, sm: 14, md: 16, lg: 18, xl: 22, xxl: 28 } as const;

export type ProgressStatus = "plan" | "playing" | "paused" | "completed" | "dropped";

export const STATUS: Record<ProgressStatus, { label: string; light: string; dark: string }> = {
  plan: { label: "Plan to Play", light: "#B7791F", dark: "#F6E05E" },
  playing: { label: "Playing", light: "#6B46C1", dark: "#B794F4" },
  paused: { label: "Paused", light: "#C05621", dark: "#F6AD55" },
  completed: { label: "Completed", light: "#2F855A", dark: "#68D391" },
  dropped: { label: "Dropped", light: "#C53030", dark: "#FC8181" },
};

export const STATUS_ORDER: ProgressStatus[] = ["playing", "paused", "plan", "completed", "dropped"];

export function useStatusColor(status: string): string {
  const scheme = useColorScheme();
  const s = STATUS[status as ProgressStatus] ?? STATUS.plan;
  return scheme === "light" ? s.light : s.dark;
}
