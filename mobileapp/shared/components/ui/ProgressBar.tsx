import { StyleSheet, View, type ViewStyle } from "react-native";
import { colors, radius } from "@/shared/constants/theme";

type ProgressBarProps = {
  value: number;
  max?: number;
  color?: string;
  style?: ViewStyle;
};

export function ProgressBar({ value, max = 100, color = colors.accent, style }: ProgressBarProps) {
  const pct = max <= 0 ? 0 : Math.max(0, Math.min(100, (value / max) * 100));

  return (
    <View accessibilityRole="progressbar" style={[styles.track, style]}>
      <View style={[styles.fill, { width: `${pct}%`, backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 8,
    borderRadius: radius.pill,
    overflow: "hidden",
    backgroundColor: colors.surfaceSoft,
  },
  fill: {
    height: "100%",
    borderRadius: radius.pill,
  },
});
