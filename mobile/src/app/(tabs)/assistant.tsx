import { useRef, useState } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import type { ChatResponse } from "@/api/client";
import { resetChat, sendChat, useGames, useInvalidateLibrary } from "@/data/hooks";
import { Button, T } from "@/ui/components";
import { cardShadow, font, radius, space, useColors } from "@/ui/theme";

/** The assistant's avatar, as on the desktop: sparkles in a purple circle. */
function Avatar({ size = 32, failed }: { size?: number; failed?: boolean }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: failed ? "#C53030" : "#6B46C1", alignItems: "center", justifyContent: "center" }}>
      <Ionicons name="sparkles-outline" size={size * 0.5} color="#FFFFFF" />
    </View>
  );
}

/** A suggestion, outlined in purple like the desktop's starter prompts. */
function Suggestion({ label, onPress }: { label: string; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({ borderRadius: radius.pill, borderWidth: 1, borderColor: c.accent, paddingHorizontal: space.md, paddingVertical: 7, backgroundColor: pressed ? c.accentSoft : "transparent" })}
    >
      <T size="sm" weight="600" tone="accent">
        {label}
      </T>
    </Pressable>
  );
}

interface Message {
  id: string;
  from: "you" | "assistant";
  text: string;
  options?: { id: string; label: string }[];
  destructiveYes?: boolean;
  error?: boolean;
}

/** **bold** and "- " list lines, the two things the assistant's replies use. */
function Rich({ text, color }: { text: string; color: string }) {
  return (
    <View style={{ gap: 2 }}>
      {text.split("\n").map((line, i) => {
        const bullet = /^\s*[-*]\s+/.test(line);
        const body = line.replace(/^\s*[-*]\s+/, "");
        const parts = body.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
        return (
          <Text key={i} style={{ color, fontSize: font.md, lineHeight: 22 }}>
            {bullet ? "•  " : ""}
            {parts.map((p, j) => (p.startsWith("**") ? <Text key={j} style={{ fontWeight: "700" }}>{p.slice(2, -2)}</Text> : <Text key={j}>{p}</Text>))}
          </Text>
        );
      })}
    </View>
  );
}

export default function Assistant() {
  const c = useColors();
  const games = useGames();
  const invalidate = useInvalidateLibrary();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [focused, setFocused] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);

  const playing = games.data?.find((g) => g.progressStatus === "playing");
  const suggestions = ["What should I play tonight?", "What's in my backlog?", playing ? `I finished ${playing.title}` : "Recommend something like Hades but shorter"];

  const send = async (raw: string) => {
    const message = raw.trim();
    if (!message || sending) return;
    setText("");
    setSending(true);
    setMessages((m) => [...m.map((x) => ({ ...x, options: undefined })), { id: `u${Date.now()}`, from: "you", text: message }]);
    try {
      const res: ChatResponse = await sendChat(message);
      const req: any = res.clarificationRequest;
      setMessages((m) => [
        ...m,
        {
          id: `a${Date.now()}`,
          from: "assistant",
          text: res.message,
          options: req?.candidates?.length ? req.candidates.map((o: any) => ({ id: String(o.id ?? o.label), label: String(o.label) })) : undefined,
          destructiveYes: req?.type === "CONFIRMATION",
        },
      ]);
      // Whatever it changed shows up everywhere else in the app.
      void invalidate();
    } catch (e) {
      setMessages((m) => [...m, { id: `e${Date.now()}`, from: "assistant", text: e instanceof Error ? e.message : "Something went wrong.", error: true }]);
    } finally {
      setSending(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    }
  };

  const clear = async () => {
    setMessages([]);
    await resetChat().catch(() => {});
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: c.border, backgroundColor: c.card }}>
          <Ionicons name="sparkles-outline" size={22} color={c.accent} />
          <View style={{ flex: 1 }}>
            <T weight="700" accessibilityRole="header">
              RoninArc AI Assistant
            </T>
            <T size="xs" tone="muted">
              Ask about your library
            </T>
          </View>
          {messages.length > 0 ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Clear the conversation" onPress={clear} hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Feather name="trash-2" size={14} color={c.danger} />
              <T size="sm" tone="danger">
                Clear
              </T>
            </Pressable>
          ) : null}
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: space.lg, gap: space.md, flexGrow: 1 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: space.md, paddingHorizontal: space.md }}>
              <Avatar size={64} />
              <T size="lg" weight="700" style={{ marginTop: space.sm }}>
                Start a new conversation
              </T>
              <T size="sm" tone="muted" style={{ textAlign: "center", lineHeight: 20 }}>
                Talk to me like a friend who knows your library. I can add games, change statuses, rate, take notes, organise collections, answer questions and suggest what to play.
              </T>
              <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: space.sm, marginTop: space.xs }}>
                {suggestions.map((s) => (
                  <Suggestion key={s} label={s} onPress={() => send(s)} />
                ))}
              </View>
            </View>
          }
          renderItem={({ item }) => {
            const mine = item.from === "you";
            return (
              <View style={{ alignItems: mine ? "flex-end" : "flex-start", gap: space.sm }}>
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space.sm, maxWidth: "92%" }}>
                  {mine ? null : <Avatar failed={item.error} />}
                  <View
                    accessibilityLabel={`${mine ? "You" : "Assistant"}: ${item.text}`}
                    style={{
                      flexShrink: 1,
                      paddingHorizontal: space.lg,
                      paddingVertical: space.md,
                      borderRadius: 16,
                      borderBottomRightRadius: mine ? 4 : 16,
                      borderBottomLeftRadius: mine ? 16 : 4,
                      backgroundColor: mine ? "#6B46C1" : c.card,
                      borderWidth: 1,
                      borderColor: mine ? "#805AD5" : item.error ? c.danger : c.border,
                      ...cardShadow,
                    }}
                  >
                    <Rich text={item.text} color={mine ? "#FFFFFF" : item.error ? c.danger : c.text} />
                  </View>
                </View>
                {item.options ? (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm, paddingLeft: 40 }}>
                    {item.options.map((o) => (
                      <Button key={o.id} title={o.label} size="sm" variant={o.id === "confirm-yes" && item.destructiveYes ? "danger" : "accent"} onPress={() => send(o.label)} disabled={sending} />
                    ))}
                  </View>
                ) : null}
              </View>
            );
          }}
          ListFooterComponent={
            sending ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, paddingTop: space.md }}>
                <Avatar />
                <ActivityIndicator color={c.accent} />
                <T tone="muted" size="sm">
                  Thinking…
                </T>
              </View>
            ) : undefined
          }
        />

        <View style={{ padding: space.md, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.bg }}>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: space.sm, padding: 6, paddingLeft: space.sm, borderRadius: radius.md, borderWidth: 2, borderColor: focused ? c.accentFill : c.border, backgroundColor: c.card }}>
          <TextInput
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            value={text}
            onChangeText={setText}
            placeholder="Type a message…"
            placeholderTextColor={c.faint}
            accessibilityLabel="Message the assistant"
            multiline
            // The focus ring is the box around it; the web input's own outline would double it.
            style={[{ flex: 1, maxHeight: 120, minHeight: 38, paddingHorizontal: space.sm, paddingTop: 9, color: c.text, fontSize: font.md }, Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null]}
            onSubmitEditing={() => send(text)}
            blurOnSubmit
            returnKeyType="send"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send"
            onPress={() => send(text)}
            disabled={!text.trim() || sending}
            style={{ width: 38, height: 38, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", backgroundColor: c.accentFill, opacity: !text.trim() || sending ? 0.45 : 1 }}
          >
            <Feather name="send" size={17} color={c.onAccentFill} />
          </Pressable>
        </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
