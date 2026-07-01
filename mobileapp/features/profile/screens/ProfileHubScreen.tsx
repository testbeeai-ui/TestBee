import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/shared/components/ui/Screen";
import { Button } from "@/shared/components/ui/Button";
import { useAuth } from "@/providers/AuthProvider";
import { colors, spacing } from "@/shared/constants/theme";
import { routes } from "@/core/navigation/routes";
import { useProfileData } from "../hooks/useProfileData";
import { ProfileStatsGrid } from "../components/ProfileStatsGrid";
import { RdmWalletCard } from "../components/RdmWalletCard";
import { RecentActivityList } from "../components/RecentActivityList";
import { SubscriptionSummaryCard } from "../components/SubscriptionSummaryCard";

export function ProfileHubScreen() {
  const { profile, user, signOut } = useAuth();
  const { attendance, activity, subscription, loading, isRefreshing, refetch } = useProfileData();

  const displayName = profile?.first_name || profile?.name || user?.email || "Student";
  const plan = profile?.plan_tier ?? "free";

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={refetch} tintColor={colors.accent} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.meta}>
            {plan} plan · {profile?.role ?? "student"}
          </Text>
        </View>

        <RdmWalletCard balance={profile?.rdm ?? 0} />
        <SubscriptionSummaryCard
          planTier={profile?.plan_tier ?? "free"}
          trial={subscription?.trial ?? null}
          onboarding={subscription?.onboarding ?? null}
        />
        <ProfileStatsGrid stats={attendance} loading={loading} />
        <RecentActivityList activity={activity} loading={loading} />

        <View style={styles.actions}>
          <Button label="Subject Chat" onPress={() => router.push(routes.chatbot)} />
          <Button label="News" variant="secondary" onPress={() => router.push(routes.news)} />
          <Button label="Blogs" variant="secondary" onPress={() => router.push(routes.blogs)} />
          <Button label="Earn & Learn" variant="secondary" onPress={() => router.push(routes.earn)} />
          <Button label="Settings" variant="secondary" onPress={() => router.push(routes.settings)} />
          <Button label="Sign out" variant="secondary" onPress={() => void signOut()} />
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
    gap: 4,
  },
  name: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "800",
  },
  meta: {
    color: colors.textMuted,
    fontSize: 14,
    textTransform: "capitalize",
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
