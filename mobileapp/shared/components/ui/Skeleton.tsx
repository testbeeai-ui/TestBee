import { StyleSheet, View, type ViewStyle } from "react-native";
import { colors, radius } from "@/shared/constants/theme";

type SkeletonProps = {
  width?: number | `${number}%`;
  height?: number;
  radiusValue?: number;
  style?: ViewStyle;
};

export function Skeleton({ width = "100%", height = 16, radiusValue = radius.md, style }: SkeletonProps) {
  return <View style={[styles.base, { width, height, borderRadius: radiusValue }, style]} />;
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.surfaceSoft,
    opacity: 0.72,
  },
});
