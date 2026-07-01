import { StyleSheet, Text, type TextProps } from "react-native";
import { colors, radius } from "@/shared/constants/theme";

type BadgeTone = "green" | "purple" | "amber" | "coral" | "neutral";

type BadgeProps = TextProps & {
  label: string;
  tone?: BadgeTone;
};

const toneStyles: Record<BadgeTone, { backgroundColor: string; color: string }> = {
  green: { backgroundColor: colors.accentMuted, color: colors.accentLight },
  purple: { backgroundColor: "rgba(83, 74, 183, 0.22)", color: colors.purpleLight },
  amber: { backgroundColor: "rgba(239, 159, 39, 0.16)", color: "#FAC775" },
  coral: { backgroundColor: "rgba(216, 90, 48, 0.18)", color: "#F6A58C" },
  neutral: { backgroundColor: colors.surfaceSoft, color: colors.textMuted },
};

export function Badge({ label, tone = "green", style, ...props }: BadgeProps) {
  return (
    <Text style={[styles.badge, toneStyles[tone], style]} {...props}>
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    overflow: "hidden",
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: "800",
  },
});
