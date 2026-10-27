import { forwardRef, type ComponentRef, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from "react-native";
import { Image } from "expo-image";
import { Feather, FontAwesome } from "@expo/vector-icons";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { font, radius, space, STATUS, useColors, useStatusColor, type ProgressStatus } from "./theme";

export function Screen({ children, scroll = true, edges = ["top"], padded = true, refreshControl }: { children: ReactNode; scroll?: boolean; edges?: Edge[]; padded?: boolean; refreshControl?: any }) {
  const c = useColors();
  const inner = padded ? { padding: space.lg, paddingBottom: space.xxl } : undefined;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={edges}>
      {scroll ? (
        <ScrollView contentContainerStyle={inner} keyboardShouldPersistTaps="handled" refreshControl={refreshControl}>
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, inner]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function T({ style, tone = "text", size = "md", weight, ...rest }: TextProps & { tone?: "text" | "muted" | "faint" | "accent" | "danger" | "success"; size?: keyof typeof font; weight?: "400" | "500" | "600" | "700" }) {
  const c = useColors();
  return <Text {...rest} style={[{ color: c[tone], fontSize: font[size], fontWeight: weight ?? "400" }, style]} />;
}

export const Heading = ({ children, size = "xl" }: { children: ReactNode; size?: keyof typeof font }) => (
  <T size={size} weight="700" accessibilityRole="header">
    {children}
  </T>
);

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const c = useColors();
  return <View style={[{ backgroundColor: c.card, borderColor: c.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, padding: space.lg }, style]}>{children}</View>;
}

export function Button({
  title,
  onPress,
  variant = "solid",
  loading,
  disabled,
  icon,
  style,
  accessibilityLabel,
}: {
  title: string;
  onPress?: () => void;
  variant?: "solid" | "outline" | "ghost" | "danger";
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Feather.glyphMap;
  style?: ViewStyle;
  accessibilityLabel?: string;
}) {
  const c = useColors();
  const solid = variant === "solid";
  const color = solid ? c.onAccent : variant === "danger" ? c.danger : variant === "ghost" ? c.muted : c.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!disabled || !!loading, busy: !!loading }}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          minHeight: 44,
          paddingHorizontal: space.lg,
          borderRadius: radius.md,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: space.sm,
          backgroundColor: solid ? c.accent : "transparent",
          borderWidth: variant === "outline" || variant === "danger" ? 1 : 0,
          borderColor: variant === "danger" ? c.danger : c.border,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={color} /> : icon ? <Feather name={icon} size={18} color={color} /> : null}
      <Text style={{ color, fontSize: font.md, fontWeight: "600" }}>{title}</Text>
    </Pressable>
  );
}

export const Field = forwardRef<ComponentRef<typeof TextInput>, TextInputProps & { label: string; hint?: string }>(function Field({ label, hint, style, ...rest }, ref) {
  const c = useColors();
  return (
    <View style={{ gap: space.xs }}>
      <T size="sm" weight="600">
        {label}
      </T>
      <TextInput
        ref={ref}
        placeholderTextColor={c.faint}
        accessibilityLabel={label}
        {...rest}
        style={[{ minHeight: 46, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, color: c.text, paddingHorizontal: space.md, fontSize: font.md }, style]}
      />
      {hint ? (
        <T size="xs" tone="faint">
          {hint}
        </T>
      ) : null}
    </View>
  );
});

export function StatusPill({ status }: { status: string }) {
  const color = useStatusColor(status);
  const label = STATUS[status as ProgressStatus]?.label ?? "Plan to Play";
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: color, paddingHorizontal: 8, paddingVertical: 2, alignSelf: "flex-start" }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
      <Text style={{ color, fontSize: font.xs, fontWeight: "600" }}>{label}</Text>
    </View>
  );
}

/** The desktop card's status badge: white on dark glass, ringed in the status colour, over the cover. */
export function StatusBadge({ status }: { status: string }) {
  const s = STATUS[status as ProgressStatus];
  if (!s) return null;
  return (
    <View style={{ borderRadius: radius.pill, borderWidth: 1, borderColor: s.ring, backgroundColor: "rgba(0,0,0,0.64)", paddingHorizontal: 8, paddingVertical: 3 }}>
      <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "700" }}>{s.label}</Text>
    </View>
  );
}

/** "★ 9/10", as under a rated card on the desktop. */
export function RatingLine({ rating }: { rating: number }) {
  const c = useColors();
  return (
    <View accessible accessibilityLabel={`Your rating: ${rating} out of 10`} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <FontAwesome name="star" size={12} color="#D69E2E" />
      <Text style={{ color: c.text, fontSize: font.xs, fontWeight: "600" }}>{rating}/10</Text>
    </View>
  );
}

/** A small label: genre tags on recommendations, "2 games" on a collection (tone "accent"). */
export function Tag({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "accent" }) {
  const c = useColors();
  const accent = tone === "accent";
  return (
    <View style={{ borderRadius: accent ? radius.pill : 4, backgroundColor: accent ? c.accentSoft : c.cardAlt, paddingHorizontal: 6, paddingVertical: 2, alignSelf: "flex-start" }}>
      <Text style={{ color: accent ? c.accent : c.text, fontSize: 11, fontWeight: "600" }}>{label}</Text>
    </View>
  );
}

/** Cover art, or the title's initial on a tinted tile when there's none. */
export function Cover({ uri, title, width, height, rounded = radius.md }: { uri?: string | null; title: string; width: number; height: number; rounded?: number }) {
  const c = useColors();
  if (!uri) {
    return (
      <View style={{ width, height, borderRadius: rounded, backgroundColor: c.accentSoft, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: c.accent, fontSize: Math.min(width, height) / 3, fontWeight: "700" }}>{title.slice(0, 1).toUpperCase()}</Text>
      </View>
    );
  }
  return <Image source={{ uri }} style={{ width, height, borderRadius: rounded, backgroundColor: c.cardAlt }} contentFit="cover" transition={150} accessibilityIgnoresInvertColors />;
}

export function Row({ children, style, ...rest }: PressableProps & { children: ReactNode; style?: ViewStyle }) {
  return (
    <Pressable {...rest} style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: space.md, opacity: pressed ? 0.7 : 1 }, style]}>
      {children}
    </Pressable>
  );
}

export function Empty({ icon, title, body, action }: { icon: keyof typeof Feather.glyphMap; title: string; body?: string; action?: ReactNode }) {
  const c = useColors();
  return (
    <View style={{ alignItems: "center", gap: space.sm, paddingVertical: space.xxl, paddingHorizontal: space.lg }}>
      <Feather name={icon} size={32} color={c.faint} />
      <T weight="600" style={{ textAlign: "center" }}>
        {title}
      </T>
      {body ? (
        <T tone="muted" size="sm" style={{ textAlign: "center" }}>
          {body}
        </T>
      ) : null}
      {action}
    </View>
  );
}

export function Loading() {
  const c = useColors();
  return (
    <View style={{ paddingVertical: space.xxl, alignItems: "center" }}>
      <ActivityIndicator color={c.accent} />
    </View>
  );
}

export function ErrorNote({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  return <Empty icon="wifi-off" title="Couldn't load this" body={message} action={onRetry ? <Button title="Try again" variant="outline" onPress={onRetry} /> : undefined} />;
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: space.xl, marginBottom: space.md }}>
      <T size="lg" weight="700" accessibilityRole="header">
        {title}
      </T>
      {action}
    </View>
  );
}

export function Chip({ label, selected, onPress, accessibilityLabel }: { label: string; selected?: boolean; onPress?: () => void; accessibilityLabel?: string }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={{ paddingHorizontal: space.md, minHeight: 36, justifyContent: "center", borderRadius: radius.pill, borderWidth: 1, borderColor: selected ? c.accent : c.border, backgroundColor: selected ? c.accentSoft : "transparent" }}
    >
      <Text style={{ color: selected ? c.accent : c.muted, fontWeight: "600", fontSize: font.sm }}>{label}</Text>
    </Pressable>
  );
}
