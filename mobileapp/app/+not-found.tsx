import { Link, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Screen } from "@/shared/components/ui/Screen";
import { colors } from "@/shared/constants/theme";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Not found" }} />
      <Screen>
        <View style={styles.container}>
          <Text style={styles.title}>This screen doesn't exist.</Text>
          <Link href="/" style={styles.link}>
            <Text style={styles.linkText}>Go home</Text>
          </Link>
        </View>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
  },
  link: {
    paddingVertical: 12,
  },
  linkText: {
    fontSize: 16,
    color: colors.accent,
    fontWeight: "600",
  },
});
