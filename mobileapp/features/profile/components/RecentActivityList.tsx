import { StyleSheet, Text, View } from "react-native";
import type { RdmRecentActivity } from "@/services/api/profile.api";
import { formatTimeAgo } from "@/core/domain/doubts";
import { colors, spacing } from "@/shared/constants/theme";

type RecentActivityListProps = {
  activity: RdmRecentActivity | null;
  loading?: boolean;
};

export function RecentActivityList({ activity, loading }: RecentActivityListProps) {
  const claims = activity?.recentClaims ?? [];

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Recent RDM activity</Text>
        {activity ? (
          <Text style={styles.window}>
            {activity.totalInWindow >= 0 ? "+" : ""}
            {activity.totalInWindow} in {activity.windowDays}d
          </Text>
        ) : null}
      </View>

      {loading && !activity ? (
        <Text style={styles.muted}>Loading activity…</Text>
      ) : claims.length === 0 ? (
        <Text style={styles.muted}>No recent claims yet. Earn RDM from lessons, Gyan++, and Earn & Learn.</Text>
      ) : (
        claims.map((claim) => (
          <View key={claim.key} style={styles.row}>
            <View style={styles.rowMain}>
              <Text style={styles.claimTitle}>{claim.title}</Text>
              <Text style={styles.detail} numberOfLines={1}>
                {claim.detail}
              </Text>
              <Text style={styles.time}>{formatTimeAgo(claim.at)}</Text>
            </View>
            <Text style={[styles.amount, claim.amount < 0 && styles.amountNeg]}>
              {claim.amount > 0 ? `+${claim.amount}` : claim.amount}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
  },
  window: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "700",
  },
  muted: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowMain: {
    flex: 1,
    gap: 2,
  },
  claimTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  detail: {
    color: colors.textMuted,
    fontSize: 12,
  },
  time: {
    color: colors.textMuted,
    fontSize: 11,
  },
  amount: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: "800",
  },
  amountNeg: {
    color: colors.danger,
  },
});
