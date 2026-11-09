import { Children, Fragment, type ReactNode } from "react";
import { ActivityIndicator, View } from "react-native";
import { radius, space, useColors } from "./theme";
import { T } from "./components";

/**
 * The desktop's Settings, on the phone: one column of sections, each a heading over a panel of
 * rows (what a setting is, then its buttons under it on a phone's width).
 */
export function SettingsSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <View style={{ marginTop: space.xl }}>
      <View style={{ marginBottom: space.md, gap: 2 }}>
        <T size="md" weight="600" accessibilityRole="header">
          {title}
        </T>
        {description ? (
          <T size="sm" tone="muted">
            {description}
          </T>
        ) : null}
      </View>
      {children}
    </View>
  );
}

export function SettingsPanel({ danger, children }: { danger?: boolean; children: ReactNode }) {
  const c = useColors();
  const rows = Children.toArray(children).filter(Boolean);
  return (
    <View style={{ borderRadius: radius.lg, borderWidth: 1, borderColor: danger ? c.danger : c.border, backgroundColor: c.card, overflow: "hidden" }}>
      {rows.map((row, i) => (
        <Fragment key={i}>
          {i > 0 ? <View style={{ height: 1, backgroundColor: c.border }} /> : null}
          {row}
        </Fragment>
      ))}
    </View>
  );
}

export function SettingsRow({ label, status, detail, lead, actions, highlight, children }: { label: ReactNode; status?: ReactNode; detail?: ReactNode; lead?: ReactNode; actions?: ReactNode; highlight?: boolean; children?: ReactNode }) {
  const c = useColors();
  return (
    <View style={{ paddingHorizontal: space.lg, paddingVertical: space.md + 2, gap: space.md, backgroundColor: highlight ? c.cardAlt : undefined }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
        {lead}
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: space.sm }}>
            <T size="md" weight="600">
              {label}
            </T>
            {status}
          </View>
          {typeof detail === "string" ? (
            <T size="sm" tone="muted">
              {detail}
            </T>
          ) : (
            detail
          )}
        </View>
      </View>
      {actions ? <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>{actions}</View> : null}
      {children}
    </View>
  );
}

export type StatusTone = "ok" | "off" | "warn" | "error" | "busy";

/** A small coloured dot and a word: "On", "Not connected". */
export function StatusDot({ tone, children }: { tone: StatusTone; children: string }) {
  const c = useColors();
  const color = { ok: c.success, off: c.faint, warn: c.warning, error: c.danger, busy: c.accent }[tone];
  return (
    <View accessible accessibilityLabel={children} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      {tone === "busy" ? <ActivityIndicator size="small" color={color} /> : <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />}
      <T size="xs" weight="600" style={{ color }}>
        {children}
      </T>
    </View>
  );
}

/** Small print under the last section. */
export function SettingsNote({ children }: { children: ReactNode }) {
  return (
    <T size="xs" tone="faint" style={{ marginTop: space.xl, textAlign: "center" }}>
      {children}
    </T>
  );
}
