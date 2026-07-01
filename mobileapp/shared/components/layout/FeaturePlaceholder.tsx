import { StyleSheet, Text, View } from "react-native";
import { Badge } from "@/shared/components/ui/Badge";
import { colors, spacing, typography } from "@/shared/constants/theme";

type FeaturePlaceholderProps = {
  title: string;
  subtitle: string;
  badge?: string;
};

export function FeaturePlaceholder({ title, subtitle, badge = "Phase 1" }: FeaturePlaceholderProps) {
  return (
    <View style={styles.wrap}>
      <Badge label={badge} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: "center",
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  title: {
    color: colors.textStrong,
    fontSize: typography.hero,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 320,
  },
});
