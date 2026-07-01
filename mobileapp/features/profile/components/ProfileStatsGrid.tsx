import { StyleSheet, Text, View } from "react-native";
import type { ProfileAttendanceSummary } from "@/services/api/profile.api";
import { formatStudyMs } from "../utils/formatStudyMs";
import { colors, spacing } from "@/shared/constants/theme";

type ProfileStatsGridProps = {
  stats: ProfileAttendanceSummary | null;
  loading?: boolean;
};

const ITEMS: Array<{
  key: keyof ProfileAttendanceSummary;
  label: string;
  format?: (v: number) => string;
}> = [
  { key: "classroomsJoined", label: "Classes" },
  { key: "assignmentTasksDone", label: "Tasks done" },
  { key: "dailyDoseDualStreak", label: "DailyDose streak" },
  { key: "mocksAttempted", label: "Mocks" },
  { key: "studyMsTotal", label: "Study time", format: formatStudyMs },
];

export function ProfileStatsGrid({ stats, loading }: ProfileStatsGridProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Your progress</Text>
      {loading && !stats ? (
        <Text style={styles.muted}>Loading stats…</Text>
      ) : (
        <View style={styles.grid}>
          {ITEMS.map((item) => {
            const raw = stats?.[item.key] ?? 0;
            const value =
              typeof raw === "number"
                ? item.format
                  ? item.format(raw)
                  : String(raw)
                : "0";
            return (
              <View key={item.key} style={styles.cell}>
                <Text style={styles.value}>{value}</Text>
                <Text style={styles.label}>{item.label}</Text>
              </View>
            );
          })}
        </View>
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
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  muted: {
    color: colors.textMuted,
    fontSize: 14,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  cell: {
    width: "47%",
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 2,
  },
  value: {
    color: colors.accent,
    fontSize: 18,
    fontWeight: "800",
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
});
