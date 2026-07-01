import { ScrollView, StyleSheet, Text, View } from "react-native";
import { EDUFUND_DEMO_PROPOSALS } from "@/core/domain/edufund";
import { Screen } from "@/shared/components/ui/Screen";
import { colors, spacing } from "@/shared/constants/theme";

type Props = { proposalId: string };

export function EduFundDetailScreen({ proposalId }: Props) {
  const proposal = EDUFUND_DEMO_PROPOSALS.find((p) => p.id === proposalId);

  if (!proposal) {
    return (
      <Screen>
        <Text style={styles.error}>Proposal not found</Text>
      </Screen>
    );
  }

  const pct = Math.min(100, Math.round((proposal.raised / proposal.goal) * 100));

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.category}>{proposal.category}</Text>
        <Text style={styles.title}>{proposal.title}</Text>
        <Text style={styles.date}>{proposal.postedDate}</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${pct}%` }]} />
        </View>
        <Text style={styles.raised}>
          ₹{proposal.raised.toLocaleString("en-IN")} raised of ₹
          {proposal.goal.toLocaleString("en-IN")} goal
        </Text>
        <Text style={styles.body}>{proposal.fullStory}</Text>
        <Text style={styles.note}>
          Supporting proposals from the mobile app will connect to the same EduFund flow on the
          website in a future release.
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  category: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "700",
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 30,
  },
  date: {
    color: colors.textMuted,
    fontSize: 13,
  },
  progressTrack: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.accent,
  },
  raised: {
    color: colors.textMuted,
    fontSize: 14,
  },
  body: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 24,
  },
  note: {
    color: colors.textMuted,
    fontSize: 13,
    fontStyle: "italic",
  },
  error: {
    color: colors.danger,
  },
});
