import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import {
  doubtHasAiAnswer,
  formatTimeAgo,
  stripHtml,
  subjectColor,
} from "@/core/domain/doubts";
import { fetchDoubtById } from "@/services/supabase/doubts.repository";
import { Screen } from "@/shared/components/ui/Screen";
import { colors, spacing } from "@/shared/constants/theme";

export default function DoubtDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const query = useQuery({
    queryKey: ["gyan", "doubt", id],
    queryFn: () => fetchDoubtById(id ?? ""),
    enabled: Boolean(id),
    refetchInterval: (q) => {
      const d = q.state.data;
      if (!d) return 3000;
      if (doubtHasAiAnswer(d) || d.is_resolved) return false;
      return 4000;
    },
  });

  const doubt = query.data;

  if (query.isLoading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }

  if (!doubt) {
    return (
      <Screen>
        <Text style={styles.error}>Doubt not found</Text>
      </Screen>
    );
  }

  const chip = subjectColor(doubt.subject);
  const answers = doubt.doubt_answers ?? [];

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.chip, { backgroundColor: chip.bg }]}>
          <Text style={[styles.chipText, { color: chip.text }]}>{doubt.subject ?? "General"}</Text>
        </View>
        <Text style={styles.title}>{stripHtml(doubt.title)}</Text>
        <Text style={styles.meta}>
          {doubt.profiles?.name ?? "Student"} · {formatTimeAgo(doubt.created_at)}
        </Text>
        {doubt.body ? <Text style={styles.body}>{stripHtml(doubt.body)}</Text> : null}

        <Text style={styles.answersTitle}>
          Answers ({answers.length})
          {!doubtHasAiAnswer(doubt) && !doubt.is_resolved ? " · Prof-Pi thinking…" : ""}
        </Text>

        {answers.length === 0 ? (
          <Text style={styles.muted}>No answers yet. Prof-Pi usually responds within a minute.</Text>
        ) : (
          answers.map((a) => (
            <View key={a.id} style={styles.answerCard}>
              <Text style={styles.answerAuthor}>{a.profiles?.name ?? "Contributor"}</Text>
              <Text style={styles.answerBody}>{stripHtml(a.body)}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  chip: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "700",
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 28,
  },
  meta: {
    color: colors.textMuted,
    fontSize: 13,
  },
  body: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  answersTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "700",
    marginTop: 8,
  },
  answerCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 6,
  },
  answerAuthor: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "700",
  },
  answerBody: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  muted: {
    color: colors.textMuted,
    fontSize: 14,
  },
  error: {
    color: colors.danger,
  },
});
