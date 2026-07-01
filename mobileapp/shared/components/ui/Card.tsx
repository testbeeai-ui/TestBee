import { StyleSheet, View, type ViewProps } from "react-native";
import { colors, radius, shadows, spacing } from "@/shared/constants/theme";

type CardProps = ViewProps & {
  elevated?: boolean;
};

export function Card({ style, elevated = false, ...props }: CardProps) {
  return <View style={[styles.card, elevated && styles.elevated, style]} {...props} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  elevated: {
    backgroundColor: colors.surfaceRaised,
    ...shadows.card,
  },
});
