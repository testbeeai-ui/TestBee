import { ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Pressable } from "react-native";
import {
  EDUFUND_DEMO_PROPOSALS,
  getEdufundNextGate,
  getEdufundRdmShortfallToNext,
  EDUFUND_MIN_RDM_CREATE_PROPOSAL,
} from "@/core/domain/edufund";
import { useAuth } from "@/providers/AuthProvider";
import { Screen } from "@/shared/components/ui/Screen";
import { Button } from "@/shared/components/ui/Button";
import { colors, spacing } from "@/shared/constants/theme";

function formatInr(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}

export function EduFundHomeScreen() {
  const { profile } = useAuth();
  const rdm = profile?.rdm ?? 0;
  const nextGate = getEdufundNextGate(rdm);
  const shortfall = getEdufundRdmShortfallToNext(rdm);
  const canCreate = rdm >= EDUFUND_MIN_RDM_CREATE_PROPOSAL;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>EduFund</Text>
        <Text style={styles.subtitle}>Turn RDM into learning grants. Same tiers as the website.</Text>

        <View style={styles.walletCard}>
          <Text style={styles.walletLabel}>Your RDM</Text>
          <Text style={styles.walletValue}>{rdm.toLocaleString("en-IN")}</Text>
          {nextGate ? (
            <Text style={styles.gateMeta}>
              {shortfall.toLocaleString("en-IN")} RDM to {nextGate.name} (
              {formatInr(nextGate.unlockInrAmount)} grant tier)
            </Text>
          ) : (
            <Text style={styles.gateMeta}>Top tier reached — Champion path complete.</Text>
          )}
        </View>

        <Button
          label={canCreate ? "Create proposal (web)" : `Need ${EDUFUND_MIN_RDM_CREATE_PROPOSAL} RDM to create`}
          variant="secondary"
          disabled={!canCreate}
          onPress={() => {}}
        />

        <Text style={styles.sectionTitle}>Community proposals</Text>
        {EDUFUND_DEMO_PROPOSALS.map((p) => {
          const pct = Math.min(100, Math.round((p.raised / p.goal) * 100));
          return (
            <Pressable
              key={p.id}
              onPress={() => router.push(`/edufund/${p.id}`)}
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
            >
              <Text style={styles.category}>{p.category}</Text>
              <Text style={styles.cardTitle}>{p.title}</Text>
              <Text style={styles.story} numberOfLines={2}>
                {p.story}
              </Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${pct}%` }]} />
              </View>
              <Text style={styles.raised}>
                {formatInr(p.raised)} of {formatInr(p.goal)} · {p.supporters} supporters
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
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
  },
  walletCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 4,
  },
  walletLabel: {
    color: colors.textMuted,
    fontSize: 13,
  },
  walletValue: {
    color: colors.accent,
    fontSize: 32,
    fontWeight: "800",
  },
  gateMeta: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
    marginTop: 8,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 6,
  },
  category: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "700",
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  story: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  progressTrack: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 999,
    overflow: "hidden",
    marginTop: 4,
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.accent,
  },
  raised: {
    color: colors.textMuted,
    fontSize: 12,
  },
});
