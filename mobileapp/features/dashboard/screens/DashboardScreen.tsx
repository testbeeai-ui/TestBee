import { RefreshControl, ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/shared/components/ui/Screen";
import { Button } from "@/shared/components/ui/Button";
import { Badge } from "@/shared/components/ui/Badge";
import { Card } from "@/shared/components/ui/Card";
import { useAuth } from "@/providers/AuthProvider";
import { colors, radius, spacing, typography } from "@/shared/constants/theme";
import { routes } from "@/core/navigation/routes";
import { useNotificationUnread } from "@/features/notifications";
import { DailyChecklistCard } from "@/features/dashboard/components/DailyChecklistCard";
import { StudyStreakCard } from "@/features/dashboard/components/StudyStreakCard";
import { useDashboardData } from "@/features/dashboard/hooks/useDashboardData";

const QUICK_LINKS = [
  { label: "Subject Chat", route: routes.chatbot },
  { label: "Earn & Learn", route: routes.earn },
  { label: "EduFund", route: routes.edufund },
  { label: "News", route: routes.news },
  { label: "Blogs", route: routes.blogs },
] as const;

export function DashboardScreen() {
  const { profile, user } = useAuth();
  const { unreadCount } = useNotificationUnread(user?.id);
  const {
    checklistItems,
    checklistDoneCount,
    checklistLoading,
    checklistError,
    streak,
    activeDaysThisMonth,
    studyDaysLoading,
    refetchAll,
    isRefreshing,
  } = useDashboardData();

  const displayName = profile?.first_name || profile?.name || "Student";

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={refetchAll} tintColor={colors.accent} />
        }
      >
        <View style={styles.header}>
          <Badge label="PUC · JEE · NEET" tone="green" />
          <View style={styles.headerRow}>
            <View style={styles.headerText}>
              <Text style={styles.greeting}>Hi, {displayName}</Text>
              <Text style={styles.plan}>{profile?.plan_tier ?? "free"} plan</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Notifications"
              onPress={() => router.push(routes.notifications)}
              style={styles.bell}
            >
              <Text style={styles.bellIcon}>🔔</Text>
              {unreadCount > 0 ? (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
                </View>
              ) : null}
            </Pressable>
          </View>
        </View>

        <View style={styles.row}>
          <StudyStreakCard
            streak={streak}
            activeDaysThisMonth={activeDaysThisMonth}
            loading={studyDaysLoading}
          />
          <Card style={styles.walletCard}>
            <Text style={styles.walletLabel}>RDM balance</Text>
            <Text style={styles.rdm}>{profile?.rdm ?? 0}</Text>
          </Card>
        </View>

        <DailyChecklistCard
          doneCount={checklistDoneCount}
          total={5}
          items={checklistItems}
          loading={checklistLoading}
          error={checklistError}
        />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Continue learning</Text>
          <Button label="Open Lessons" onPress={() => router.push(routes.learn)} />
          <Button label="Gyan++" variant="secondary" onPress={() => router.push(routes.gyan)} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Explore</Text>
          <View style={styles.linkGrid}>
            {QUICK_LINKS.map((link) => (
              <Pressable
                key={link.route}
                onPress={() => router.push(link.route)}
                style={styles.linkChip}
              >
                <Text style={styles.linkChipText}>{link.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  header: {
    gap: spacing.sm,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  greeting: {
    color: colors.textStrong,
    fontSize: typography.hero,
    fontWeight: "800",
  },
  plan: {
    color: colors.textMuted,
    fontSize: 14,
    textTransform: "capitalize",
  },
  bell: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  bellIcon: {
    fontSize: 20,
  },
  bellBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  bellBadgeText: {
    color: "#04130d",
    fontSize: 10,
    fontWeight: "800",
  },
  row: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  walletCard: {
    flex: 1,
    justifyContent: "center",
  },
  walletLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
  },
  rdm: {
    color: colors.accent,
    fontSize: 22,
    fontWeight: "800",
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.textStrong,
    fontSize: typography.title,
    fontWeight: "700",
  },
  linkGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  linkChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  linkChipText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
});
