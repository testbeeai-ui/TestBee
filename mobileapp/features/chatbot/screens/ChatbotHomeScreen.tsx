import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import type { ChatMessage } from "@/core/domain/chatbot";
import { chatbotApi } from "@/services/api/chatbot.api";
import { Screen } from "@/shared/components/ui/Screen";
import { ChatBubble } from "@/shared/components/chat/ChatBubble";
import { colors, spacing } from "@/shared/constants/theme";

const SUBJECTS = [
  { id: "physics" as const, label: "Physics" },
  { id: "chemistry" as const, label: "Chemistry" },
  { id: "math" as const, label: "Math" },
];

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function ChatbotHomeScreen() {
  const [subject, setSubject] = useState<"physics" | "chemistry" | "math">("physics");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: newId(),
      role: "assistant",
      content: "Hi! I'm Prof-Pi. Ask me anything about Physics, Chemistry, or Math.",
      createdAt: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const quotaQuery = useQuery({
    queryKey: ["chatbot", "quota"],
    queryFn: () => chatbotApi.getQuota(),
  });

  const listRef = useRef<FlatList<ChatMessage>>(null);

  const scrollToEnd = useCallback(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  const send = async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;
    if (quotaQuery.data && !quotaQuery.data.canSend && !quotaQuery.data.unlimited) {
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: "assistant",
          content: "Daily chat limit reached on your plan. Upgrade on the website for unlimited Prof-Pi.",
          createdAt: Date.now(),
        },
      ]);
      return;
    }

    const userMsg: ChatMessage = {
      id: newId(),
      role: "user",
      content: trimmed,
      createdAt: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);
    scrollToEnd();

    try {
      const res = await chatbotApi.sendMessage({
        subject,
        message: trimmed,
        gradeLevel: 12,
        language: "en",
      });
      const reply =
        res.reply ||
        res.error ||
        "Sorry, I could not generate a response right now.";
      setMessages((prev) => [
        ...prev,
        { id: newId(), role: "assistant", content: reply, createdAt: Date.now() },
      ]);
      void quotaQuery.refetch();
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: "assistant",
          content: e instanceof Error ? e.message : "Connection error. Try again.",
          createdAt: Date.now(),
        },
      ]);
    } finally {
      setSending(false);
      scrollToEnd();
    }
  };

  const quota = quotaQuery.data;

  return (
    <Screen padded={false}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={88}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Prof-Pi</Text>
          {quota ? (
            <Text style={styles.quota}>
              {quota.unlimited
                ? "Unlimited chat"
                : `${quota.usedToday}/${quota.dailyLimit ?? "∞"} today`}
            </Text>
          ) : null}
        </View>

        <View style={styles.chips}>
          {SUBJECTS.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => setSubject(s.id)}
              style={[styles.chip, subject === s.id && styles.chipActive]}
            >
              <Text style={[styles.chipText, subject === s.id && styles.chipTextActive]}>
                {s.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          onContentSizeChange={scrollToEnd}
          renderItem={({ item }) => <ChatBubble role={item.role} content={item.content} />}
        />

        <View style={styles.composer}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask Prof-Pi…"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            multiline
            maxLength={2000}
          />
          <Pressable
            onPress={() => void send()}
            disabled={sending || !input.trim()}
            style={[styles.sendBtn, (sending || !input.trim()) && styles.sendDisabled]}
          >
            {sending ? (
              <ActivityIndicator color="#04130d" size="small" />
            ) : (
              <Text style={styles.sendLabel}>Send</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 2,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
  },
  quota: {
    color: colors.textMuted,
    fontSize: 12,
  },
  chips: {
    flexDirection: "row",
    gap: 8,
    padding: spacing.md,
    paddingBottom: spacing.sm,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  chipText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
  },
  chipTextActive: {
    color: colors.accent,
  },
  list: {
    padding: spacing.md,
    paddingBottom: spacing.sm,
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 16,
  },
  sendBtn: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingHorizontal: 16,
    minHeight: 44,
    justifyContent: "center",
  },
  sendDisabled: {
    opacity: 0.5,
  },
  sendLabel: {
    color: "#04130d",
    fontWeight: "700",
    fontSize: 15,
  },
});
