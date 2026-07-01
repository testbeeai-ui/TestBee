import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import type { ChecklistItem } from "@/core/domain/checklist";
import { Card } from "@/shared/components/ui/Card";
import { ProgressBar } from "@/shared/components/ui/ProgressBar";
import { Skeleton } from "@/shared/components/ui/Skeleton";
import { colors, radius, spacing, typography } from "@/shared/constants/theme";

type DailyChecklistCardProps = {
  doneCount: number;
  total: number;
  items: ChecklistItem[];
  loading?: boolean;
  error?: boolean;
};

export function DailyChecklistCard({
  doneCount,
  total,
  items,
  loading,
  error,
}: DailyChecklistCardProps) {
  return (
    <Card elevated>
      <Text style={styles.title}>Today's habits</Text>
      {loading ? (
        <>
          <Skeleton width="72%" />
          <Skeleton height={8} radiusValue={radius.pill} />
          <Skeleton width="92%" height={18} />
          <Skeleton width="84%" height={18} />
        </>
      ) : error ? (
        <Text style={styles.error}>Could not load checklist. Is the API running?</Text>
      ) : (
        <>
          <Text style={styles.meta}>
            {doneCount >= total
              ? "All habits complete - nice work!"
              : `${doneCount} of ${total} habits checked off`}
          </Text>
          <ProgressBar value={doneCount} max={total} />
          <View style={styles.list}>
            {items.map((item) => {
              const row = (
                <>
                  <Text style={[styles.bullet, item.done && styles.bulletDone]}>
                    {item.done ? "✓" : "○"}
                  </Text>
                  <View style={styles.labelWrap}>
                    <Text style={[styles.label, item.done && styles.labelDone]}>{item.shortLabel}</Text>
                    {!item.route ? <Text style={styles.webOnly}>Complete on edublast.in</Text> : null}
                  </View>
                </>
              );

              if (!item.route) {
                return (
                  <View key={item.id} style={styles.row}>
                    {row}
                  </View>
                );
              }

              return (
                <Pressable
                  key={item.id}
                  onPress={() => router.push(item.route as never)}
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                >
                  {row}
                </Pressable>
              );
            })}
          </View>
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.textStrong,
    fontSize: typography.title,
    fontWeight: "700",
  },
  meta: {
    color: colors.textMuted,
    fontSize: typography.body,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
  },
  list: {
    marginTop: spacing.xs,
    gap: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    minHeight: 28,
  },
  rowPressed: {
    opacity: 0.85,
  },
  bullet: {
    color: colors.textMuted,
    fontSize: 16,
    width: 18,
  },
  bulletDone: {
    color: colors.accentLight,
  },
  labelWrap: {
    flex: 1,
    gap: 2,
  },
  label: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 20,
  },
  labelDone: {
    color: colors.text,
  },
  webOnly: {
    color: colors.textDim,
    fontSize: 11,
    fontStyle: "italic",
  },
});
