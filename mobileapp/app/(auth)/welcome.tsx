import { Image, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Badge } from "@/shared/components/ui/Badge";
import { Button } from "@/shared/components/ui/Button";
import { Card } from "@/shared/components/ui/Card";
import { Screen } from "@/shared/components/ui/Screen";
import { colors, radius, shadows, spacing, typography } from "@/shared/constants/theme";
import { routes } from "@/core/navigation/routes";

export default function WelcomeScreen() {
  return (
    <Screen>
      <View style={styles.root}>
        <View style={styles.brandRow}>
          <Image source={require("@/assets/images/icon.png")} style={styles.logo} />
          <View style={styles.brandCopy}>
            <Text style={styles.brand}>EduBlast</Text>
            <Text style={styles.brandMeta}>Testbee learning network</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <Badge label="AI study companion" tone="green" />
          <Text style={styles.title}>Learn faster, ask better, earn as you grow.</Text>
          <Text style={styles.subtitle}>
            Gyan++, lessons, referrals, RDM and student progress in one native mobile space.
          </Text>
        </View>

        <Card elevated style={styles.previewCard}>
          <View style={styles.previewHeader}>
            <Text style={styles.previewTitle}>Today on EduBlast</Text>
            <Text style={styles.previewRdm}>+25 RDM</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={styles.progressFill} />
          </View>
          <View style={styles.previewRows}>
            <Text style={styles.previewItem}>Ask a doubt on Gyan++</Text>
            <Text style={styles.previewItem}>Continue Physics revision</Text>
            <Text style={styles.previewItemMuted}>Invite a study buddy</Text>
          </View>
        </Card>

        <View style={styles.footer}>
          <Button label="Get started" onPress={() => router.push(routes.signIn)} />
          <Text style={styles.finePrint}>One account for web and mobile.</Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "space-between",
    paddingVertical: spacing.lg,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    ...shadows.card,
  },
  brandCopy: {
    gap: 2,
  },
  brand: {
    color: colors.textStrong,
    fontSize: typography.title,
    fontWeight: "900",
  },
  brandMeta: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: "600",
  },
  hero: {
    gap: spacing.md,
    paddingVertical: spacing.xl,
  },
  title: {
    color: colors.textStrong,
    fontSize: 34,
    fontWeight: "900",
    lineHeight: 40,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: typography.bodyLarge,
    lineHeight: 24,
    maxWidth: 330,
  },
  previewCard: {
    gap: spacing.md,
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  previewTitle: {
    color: colors.text,
    fontSize: typography.bodyLarge,
    fontWeight: "800",
  },
  previewRdm: {
    color: colors.amber,
    fontSize: typography.body,
    fontWeight: "900",
  },
  progressTrack: {
    height: 8,
    borderRadius: radius.pill,
    overflow: "hidden",
    backgroundColor: colors.surfaceSoft,
  },
  progressFill: {
    width: "62%",
    height: "100%",
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  previewRows: {
    gap: spacing.sm,
  },
  previewItem: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "600",
  },
  previewItemMuted: {
    color: colors.textMuted,
    fontSize: typography.body,
    fontWeight: "600",
  },
  footer: {
    gap: spacing.sm,
  },
  finePrint: {
    color: colors.textDim,
    fontSize: typography.caption,
    textAlign: "center",
  },
});
