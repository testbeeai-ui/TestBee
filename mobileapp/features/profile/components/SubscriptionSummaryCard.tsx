import { Linking, StyleSheet, Text, View } from "react-native";
import type { OnboardingRewardStatus, TrialGateStatus } from "@/services/api/profile.api";
import { colors, spacing } from "@/shared/constants/theme";

type SubscriptionSummaryCardProps = {
  planTier: string;
  trial: TrialGateStatus | null;
  onboarding: OnboardingRewardStatus | null;
};

export function SubscriptionSummaryCard({ planTier, trial, onboarding }: SubscriptionSummaryCardProps) {
  const trialActive = onboarding?.freeTrialActivated ?? trial?.free_trial_activated;
  const paymentDue = trial?.required === true;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Subscription</Text>
      <Text style={styles.plan}>{planTier} plan</Text>
      {trialActive ? (
        <Text style={styles.meta}>Free trial active — manage upgrades on edublast.in</Text>
      ) : (
        <Text style={styles.meta}>Upgrade to Starter or Pro on the website for more features.</Text>
      )}
      {paymentDue ? (
        <Text style={styles.alert}>Trial ended — complete payment on edublast.in to keep full access.</Text>
      ) : null}
      <Text
        style={styles.link}
        onPress={() => void Linking.openURL("https://www.edublast.in/profile?section=subscriptions")}
      >
        Open subscription on web →
      </Text>
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
    gap: 6,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  plan: {
    color: colors.accent,
    fontSize: 18,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  meta: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  alert: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 4,
  },
  link: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 4,
  },
});
