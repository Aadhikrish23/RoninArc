import { forwardRef, useState, type ComponentRef, type ReactNode } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type PressableProps,
  type TextInputProps,
  type TextProps,
  type ViewProps,
  type ViewStyle,
} from "react-native";
import { Image } from "expo-image";
import { Feather, FontAwesome } from "@expo/vector-icons";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { cardShadow, font, radius, space, STATUS, useColors, useStatusColor, type ProgressStatus } from "./theme";

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

/** A desktop card: white, a 1px gray.200 border, 12px corners and Chakra's small shadow. */
export function Card({ children, style, ...rest }: Omit<ViewProps, "style"> & { children: ReactNode; style?: ViewStyle }) {
  const c = useColors();
  return <View {...rest} style={[{ backgroundColor: c.card, borderColor: c.border, borderWidth: 1, borderRadius: radius.lg, padding: space.lg, ...cardShadow }, style]}>{children}</View>;
}

/** The title block every desktop page opens with: a big heading and one muted line under it. */
export function PageHeader({ title, subtitle, right, onBack }: { title: string; subtitle?: string; right?: ReactNode; onBack?: () => void }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space.md, marginBottom: space.sm }}>
      {onBack ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} hitSlop={12} style={{ paddingTop: 6 }}>
          <Feather name="arrow-left" size={22} color={c.text} />
        </Pressable>
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        <T size="xxl" weight="700" accessibilityRole="header" style={{ letterSpacing: -0.4 }}>
          {title}
        </T>
        {subtitle ? (
          <T size="sm" tone="muted">
            {subtitle}
          </T>
        ) : null}
      </View>
      {right}
    </View>
  );
}

/**
 * A titled desktop panel (Dashboard, Settings): a purple outline icon, a bold title, an optional
 * muted line and a link on the right, then the content.
 */
export function Panel({ icon, title, subtitle, action, children, tone = "normal", style }: { icon?: keyof typeof Feather.glyphMap; title: string; subtitle?: string; action?: ReactNode; children?: ReactNode; tone?: "normal" | "danger"; style?: ViewStyle }) {
  const c = useColors();
  const danger = tone === "danger";
  return (
    <Card style={{ gap: space.md, marginTop: space.lg, ...(danger ? { backgroundColor: c.dangerSoft, borderColor: c.danger } : null), ...style }}>
      <View style={{ gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
          {icon ? <Feather name={icon} size={18} color={danger ? c.danger : c.accent} /> : null}
          <T size="lg" weight="700" accessibilityRole="header" style={{ flex: 1 }}>
            {title}
          </T>
          {action}
        </View>
        {subtitle ? (
          <T size="sm" tone="muted">
            {subtitle}
          </T>
        ) : null}
      </View>
      {children}
    </Card>
  );
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
  size = "md",
}: {
  title: string;
  onPress?: () => void;
  // solid: Chakra purple; outline: white with a gray border; accent: purple outline ("View all
  // games", "Open"); danger: red outline; dangerSolid: the red "Delete account"; ghost: text only.
  // brand: the desktop login's button, white on purple.500 in either theme.
  variant?: "solid" | "brand" | "outline" | "accent" | "ghost" | "danger" | "dangerSolid";
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Feather.glyphMap;
  style?: ViewStyle;
  accessibilityLabel?: string;
  size?: "md" | "sm";
}) {
  const c = useColors();
  const solid = variant === "solid";
  const color = solid ? c.onAccentFill : variant === "dangerSolid" || variant === "brand" ? "#FFFFFF" : variant === "danger" ? c.danger : variant === "accent" ? c.accent : variant === "ghost" ? c.muted : c.text;
  const background = solid ? c.accentFill : variant === "brand" ? "#805AD5" : variant === "dangerSolid" ? "#E53E3E" : variant === "outline" ? c.card : "transparent";
  const border = variant === "danger" ? c.danger : variant === "accent" ? c.accent : variant === "outline" ? c.border : "transparent";
  const small = size === "sm";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!disabled || !!loading, busy: !!loading }}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          minHeight: small ? 34 : 44,
          paddingHorizontal: small ? space.md : space.lg,
          borderRadius: radius.sm,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: space.sm,
          backgroundColor: background,
          borderWidth: border === "transparent" ? 0 : 1,
          borderColor: border,
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={color} /> : icon ? <Feather name={icon} size={small ? 15 : 17} color={color} /> : null}
      <Text style={{ color, fontSize: small ? font.sm : font.md, fontWeight: "600" }}>{title}</Text>
    </Pressable>
  );
}

// hideLabel: a search box like the desktop's "Search library…", named for screen readers only.
export const Field = forwardRef<ComponentRef<typeof TextInput>, TextInputProps & { label: string; hint?: string; hideLabel?: boolean }>(function Field({ label, hint, hideLabel, style, onFocus, onBlur, ...rest }, ref) {
  const c = useColors();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: space.xs }}>
      {hideLabel ? null : (
        <T size="sm" weight="600">
          {label}
        </T>
      )}
      <TextInput
        ref={ref}
        placeholderTextColor={c.faint}
        accessibilityLabel={label}
        onFocus={(e) => (setFocused(true), onFocus?.(e))}
        onBlur={(e) => (setFocused(false), onBlur?.(e))}
        {...rest}
        // Chakra's input: 6px corners, gray border, purple when focused.
        style={[{ minHeight: 44, borderRadius: radius.sm, borderWidth: 1, borderColor: focused ? c.accentFill : c.border, backgroundColor: c.card, color: c.text, paddingHorizontal: space.md, fontSize: font.md }, Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null, style]}
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
      // A Chakra small button: white with a gray border, solid purple when chosen (like the active nav item).
      style={{ paddingHorizontal: space.md, minHeight: 34, justifyContent: "center", borderRadius: radius.sm, borderWidth: 1, borderColor: selected ? c.accentFill : c.border, backgroundColor: selected ? c.accentFill : c.card }}
    >
      <Text style={{ color: selected ? c.onAccentFill : c.muted, fontWeight: "600", fontSize: font.sm }}>{label}</Text>
    </Pressable>
  );
}
