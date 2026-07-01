import { StyleSheet, Text } from "react-native";
import { Card } from "@/shared/components/ui/Card";
import { Skeleton } from "@/shared/components/ui/Skeleton";
import { colors, typography } from "@/shared/constants/theme";

type StudyStreakCardProps = {
  streak: number;
  activeDaysThisMonth?: number;
  loading?: boolean;
};

export function StudyStreakCard({ streak, activeDaysThisMonth, loading }: StudyStreakCardProps) {
  return (
    <Card style={styles.card}>
      <Text style={styles.label}>Study streak</Text>
      {loading ? (
        <>
          <Skeleton width="58%" height={28} />
          <Skeleton width="82%" height={12} />
        </>
      ) : (
        <>
          <Text style={styles.value}>
            {streak} day{streak === 1 ? "" : "s"}
          </Text>
          {typeof activeDaysThisMonth === "number" ? (
            <Text style={styles.meta}>{activeDaysThisMonth} active days this month</Text>
          ) : null}
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
  },
  label: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: "600",
  },
  value: {
    color: colors.accent,
    fontSize: typography.hero,
    fontWeight: "800",
  },
  meta: {
    color: colors.textMuted,
    fontSize: typography.caption,
  },
});
