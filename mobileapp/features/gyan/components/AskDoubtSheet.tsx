import { useEffect, useState } from "react";
import {
  Modal,
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { DOUBT_POST_SUBJECTS } from "@/core/domain/doubts";
import { gyanApi } from "@/services/api/gyan.api";
import { Button } from "@/shared/components/ui/Button";
import { colors, spacing } from "@/shared/constants/theme";

type AskDoubtSheetProps = {
  visible: boolean;
  onClose: () => void;
  onPosted: (doubtId: string) => void;
};

export function AskDoubtSheet({ visible, onClose, onPosted }: AskDoubtSheetProps) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [subject, setSubject] = useState<string>(DOUBT_POST_SUBJECTS[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accessQuery = useQuery({
    queryKey: ["gyan", "access"],
    queryFn: () => gyanApi.getAccess(),
    enabled: visible,
  });

  useEffect(() => {
    if (!visible) {
      setTitle("");
      setBody("");
      setSubject(DOUBT_POST_SUBJECTS[0]);
      setError(null);
    }
  }, [visible]);

  const handleSubmit = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Title is required");
      return;
    }
    if (accessQuery.data && !accessQuery.data.canPost) {
      setError("Daily doubt limit reached. Upgrade for more posts.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await gyanApi.postDoubt({ title: trimmed, body: body.trim(), subject });
      if (!res.ok || !res.id) {
        setError(res.error ?? "Could not post doubt");
        return;
      }
      const doubtId = String(res.id);
      void gyanApi.triggerProfPiAnswer(doubtId);
      onPosted(doubtId);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not post doubt");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Ask a doubt</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.close}>Close</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Subject</Text>
          <View style={styles.chips}>
            {DOUBT_POST_SUBJECTS.map((s) => (
              <Pressable
                key={s}
                onPress={() => setSubject(s)}
                style={[styles.chip, subject === s && styles.chipActive]}
              >
                <Text style={[styles.chipText, subject === s && styles.chipTextActive]}>{s}</Text>
              </Pressable>
            ))}
          </View>

          {accessQuery.data ? (
            <Text style={styles.quota}>
              {accessQuery.data.unlimited
                ? "Unlimited posts on your plan"
                : `${accessQuery.data.usedToday}/${accessQuery.data.dailyLimit} posts today`}
            </Text>
          ) : null}

          <Text style={styles.label}>Question</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="What are you stuck on?"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            multiline
          />

          <Text style={styles.label}>Details (optional)</Text>
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="Steps you tried, where you got stuck…"
            placeholderTextColor={colors.textMuted}
            style={[styles.input, styles.inputTall]}
            multiline
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button label="Post to Gyan++" loading={submitting} onPress={() => void handleSubmit()} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  close: {
    color: colors.accent,
    fontSize: 16,
  },
  form: {
    padding: spacing.md,
    gap: spacing.sm,
    paddingBottom: 40,
  },
  label: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 4,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  chipText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "600",
  },
  chipTextActive: {
    color: colors.accent,
  },
  quota: {
    color: colors.textMuted,
    fontSize: 12,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    color: colors.text,
    fontSize: 16,
    minHeight: 48,
    textAlignVertical: "top",
  },
  inputTall: {
    minHeight: 100,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
  },
});
