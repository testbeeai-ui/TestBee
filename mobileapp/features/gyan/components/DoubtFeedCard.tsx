import { Pressable, StyleSheet, Text, View } from "react-native";
import type { DoubtRow } from "@/core/domain/doubts";
import { doubtHasAiAnswer, formatTimeAgo, stripHtml, subjectColor } from "@/core/domain/doubts";
import { colors, spacing } from "@/shared/constants/theme";

type DoubtFeedCardProps = {
  doubt: DoubtRow;
  onPress: () => void;
};

export function DoubtFeedCard({ doubt, onPress }: DoubtFeedCardProps) {
  const answers = doubt.doubt_answers?.length ?? 0;
  const chip = subjectColor(doubt.subject);
  const preview = stripHtml(doubt.body || doubt.title).slice(0, 140);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.top}>
        <View style={[styles.chip, { backgroundColor: chip.bg }]}>
          <Text style={[styles.chipText, { color: chip.text }]}>{doubt.subject ?? "General"}</Text>
        </View>
        <Text style={styles.time}>{formatTimeAgo(doubt.created_at)}</Text>
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {stripHtml(doubt.title)}
      </Text>
      {preview ? (
        <Text style={styles.body} numberOfLines={2}>
          {preview}
        </Text>
      ) : null}
      <View style={styles.meta}>
        <Text style={styles.metaText}>
          {answers} answer{answers === 1 ? "" : "s"}
          {doubtHasAiAnswer(doubt) ? " · Prof-Pi" : ""}
          {doubt.is_resolved ? " · Resolved" : ""}
        </Text>
        {doubt.bounty_rdm ? <Text style={styles.bounty}>+{doubt.bounty_rdm} RDM</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 8,
  },
  pressed: {
    opacity: 0.92,
  },
  top: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "700",
  },
  time: {
    color: colors.textMuted,
    fontSize: 12,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22,
  },
  body: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  meta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  metaText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  bounty: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "700",
  },
});
