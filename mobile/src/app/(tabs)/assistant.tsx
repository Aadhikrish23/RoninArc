import { useRef, useState } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import type { ChatResponse } from "@/api/client";
import { resetChat, sendChat, useGames, useInvalidateLibrary } from "@/data/hooks";
import { Button, Chip, Heading, T } from "@/ui/components";
import { font, radius, space, useColors } from "@/ui/theme";

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
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.sm }}>
          <Heading>Assistant</Heading>
          {messages.length > 0 ? <Button title="Clear" variant="ghost" icon="rotate-ccw" onPress={clear} /> : null}
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: space.lg, gap: space.md, flexGrow: 1 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <View style={{ flex: 1, justifyContent: "center", gap: space.md }}>
              <T tone="muted">Talk to it like a friend: add games, change statuses, rate, take notes, sort collections, or ask what to play.</T>
              <View style={{ gap: space.sm, alignItems: "flex-start" }}>
                {suggestions.map((s) => (
                  <Chip key={s} label={s} onPress={() => send(s)} />
                ))}
              </View>
            </View>
          }
          renderItem={({ item }) => {
            const mine = item.from === "you";
            return (
              <View style={{ alignItems: mine ? "flex-end" : "flex-start", gap: space.sm }}>
                <View
                  accessibilityLabel={`${mine ? "You" : "Assistant"}: ${item.text}`}
                  style={{ maxWidth: "88%", padding: space.md, borderRadius: radius.lg, backgroundColor: mine ? c.accent : item.error ? c.cardAlt : c.card, borderWidth: mine ? 0 : 1, borderColor: c.border }}
                >
                  <Rich text={item.text} color={mine ? c.onAccent : item.error ? c.danger : c.text} />
                </View>
                {item.options ? (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
                    {item.options.map((o) => (
                      <Button key={o.id} title={o.label} variant={o.id === "confirm-yes" && item.destructiveYes ? "danger" : "outline"} onPress={() => send(o.label)} disabled={sending} />
                    ))}
                  </View>
                ) : null}
              </View>
            );
          }}
          ListFooterComponent={
            sending ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, paddingTop: space.md }}>
                <ActivityIndicator color={c.accent} />
                <T tone="muted" size="sm">
                  Thinking…
                </T>
              </View>
            ) : undefined
          }
        />

        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: space.sm, padding: space.md, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.card }}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="e.g. rate hollow knight 9"
            placeholderTextColor={c.faint}
            accessibilityLabel="Message the assistant"
            multiline
            style={{ flex: 1, maxHeight: 120, minHeight: 44, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, paddingHorizontal: space.md, paddingTop: 11, color: c.text, fontSize: font.md, backgroundColor: c.bg }}
            onSubmitEditing={() => send(text)}
            blurOnSubmit
            returnKeyType="send"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send"
            onPress={() => send(text)}
            disabled={!text.trim() || sending}
            style={{ width: 44, height: 44, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: c.accent, opacity: !text.trim() || sending ? 0.5 : 1 }}
          >
            <Feather name="send" size={18} color={c.onAccent} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
