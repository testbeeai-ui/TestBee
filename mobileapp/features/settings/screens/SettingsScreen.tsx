import { Linking, StyleSheet, Switch, Text, View } from "react-native";
import { Screen } from "@/shared/components/ui/Screen";
import { Button } from "@/shared/components/ui/Button";
import { useAuth } from "@/providers/AuthProvider";
import { usePushNotifications } from "@/providers/PushNotificationsProvider";
import { colors, spacing } from "@/shared/constants/theme";
import { router } from "expo-router";
import { routes } from "@/core/navigation/routes";
import { SubscriptionSummaryCard } from "@/features/profile/components/SubscriptionSummaryCard";
import { useProfileHubData } from "@/features/profile/hooks/useProfileData";

export function SettingsScreen() {
  const { profile, user, signOut } = useAuth();
  const { pushEnabled, pushReady, pushSupported, lastToken, setPushNotificationsEnabled } =
    usePushNotifications();
  const { subscription } = useProfileHubData();

  return (
    <Screen>
      <SubscriptionSummaryCard
        planTier={profile?.plan_tier ?? "free"}
        trial={subscription?.trial ?? null}
        onboarding={subscription?.onboarding ?? null}
      />

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Account</Text>
        <Text style={styles.rowLabel}>Email</Text>
        <Text style={styles.rowValue}>{user?.email ?? "—"}</Text>
        <Text style={styles.rowLabel}>RDM balance</Text>
        <Text style={styles.rowValue}>{profile?.rdm ?? 0}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        <View style={styles.switchRow}>
          <View style={styles.switchCopy}>
            <Text style={styles.switchLabel}>Push notifications</Text>
            <Text style={styles.switchHint}>
              {!pushSupported
                ? "Unavailable in Expo Go — use a dev build or preview APK"
                : lastToken
                  ? "Device registered for alerts"
                  : "Requires a physical device + EAS project ID"}
            </Text>
          </View>
          <Switch
            value={pushEnabled}
            disabled={!pushReady || !pushSupported}
            onValueChange={(v) => void setPushNotificationsEnabled(v)}
            trackColor={{ false: colors.border, true: colors.accentMuted }}
            thumbColor={pushEnabled ? colors.accent : colors.textMuted}
          />
        </View>
        <Button
          label="Notification inbox"
          variant="secondary"
          onPress={() => router.push(routes.notifications)}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Legal</Text>
        <Button
          label="Terms & conditions"
          variant="secondary"
          onPress={() => void Linking.openURL("https://www.edublast.in/terms")}
        />
        <Button
          label="Privacy policy"
          variant="secondary"
          onPress={() => void Linking.openURL("https://www.edublast.in/privacy")}
        />
      </View>

      <Button label="Sign out" variant="secondary" onPress={() => void signOut()} />
    </Screen>
  );
}

export default SettingsScreen;

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  rowLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  },
  rowValue: {
    color: colors.text,
    fontSize: 15,
    textTransform: "capitalize",
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  switchCopy: {
    flex: 1,
    gap: 2,
  },
  switchLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  switchHint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
});
