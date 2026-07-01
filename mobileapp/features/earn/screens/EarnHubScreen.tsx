import { useState } from "react";
import {
  Alert,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { Screen } from "@/shared/components/ui/Screen";
import { Button } from "@/shared/components/ui/Button";
import { colors, spacing } from "@/shared/constants/theme";
import { routes } from "@/core/navigation/routes";
import { earnApi } from "@/services/api/earn.api";
import { useEarnData } from "../hooks/useEarnData";

export function EarnHubScreen() {
  const { buddy, referrals, leaderboard, isLoading, isRefreshing, refetch } = useEarnData();
  const [inviting, setInviting] = useState(false);

  const shareBuddyInvite = async () => {
    setInviting(true);
    try {
      const res = await earnApi.createBuddyInvite();
      if (!res.ok || !res.shareUrl) {
        Alert.alert("Invite failed", res.error ?? "Could not create invite");
        return;
      }
      await Share.share({
        message: res.waText ?? res.shareUrl,
        url: res.shareUrl,
      });
      refetch();
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not share invite");
    } finally {
      setInviting(false);
    }
  };

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={refetch} tintColor={colors.accent} />
        }
      >
        <Text style={styles.title}>Earn & Learn</Text>
        <Text style={styles.subtitle}>Grow your RDM through buddies, referrals, and challenges.</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Learning buddy</Text>
          {buddy?.buddies?.length ? (
            buddy.buddies.map((b) => (
              <View key={b.id} style={styles.row}>
                <Text style={styles.rowTitle}>{b.name ?? "Buddy"}</Text>
                <Text style={styles.rowMeta}>{b.rdm} RDM</Text>
              </View>
            ))
          ) : (
            <Text style={styles.muted}>No active buddy yet. Invite a friend to study together.</Text>
          )}
          <Button
            label={inviting ? "Creating…" : "Invite study buddy"}
            loading={inviting}
            onPress={() => void shareBuddyInvite()}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Your referrals</Text>
          {referrals.length === 0 ? (
            <Text style={styles.muted}>When friends join with your link, they appear here.</Text>
          ) : (
            referrals.slice(0, 8).map((r) => (
              <View key={r.id} style={styles.row}>
                <Text style={styles.rowTitle}>{r.refereeName}</Text>
                <Text style={styles.rowMeta}>
                  {new Date(r.creditedAt).toLocaleDateString()}
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Weekly leaderboard</Text>
          {leaderboard.length === 0 ? (
            <Text style={styles.muted}>No referrals this week yet.</Text>
          ) : (
            leaderboard.slice(0, 5).map((e) => (
              <View key={e.rank} style={styles.row}>
                <Text style={styles.rowTitle}>
                  #{e.rank} {e.name}
                </Text>
                <Text style={styles.rowMeta}>{e.referralCount} refs</Text>
              </View>
            ))
          )}
        </View>

        <Button label="Open EduFund" variant="secondary" onPress={() => router.push(routes.edufund)} />
        <Button label="Try Challenge Yourself" variant="secondary" onPress={() => router.push(routes.earn)} />
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
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "700",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  rowTitle: {
    color: colors.text,
    fontSize: 14,
    flex: 1,
  },
  rowMeta: {
    color: colors.textMuted,
    fontSize: 12,
  },
  muted: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
});
