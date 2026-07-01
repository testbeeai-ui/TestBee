import { StyleSheet, Text, View, type ViewProps } from "react-native";
import { Badge } from "./Badge";
import { colors, spacing, typography } from "@/shared/constants/theme";

type EmptyStateProps = ViewProps & {
  title: string;
  subtitle: string;
  badge?: string;
};

export function EmptyState({ title, subtitle, badge = "Ready", style, ...props }: EmptyStateProps) {
  return (
    <View style={[styles.wrap, style]} {...props}>
      <Badge label={badge} tone="purple" />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "flex-start",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  title: {
    color: colors.textStrong,
    fontSize: typography.title,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 21,
  },
});
