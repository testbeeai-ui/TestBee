import { Linking, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Button } from "@/shared/components/ui/Button";
import { Card } from "@/shared/components/ui/Card";
import { Screen } from "@/shared/components/ui/Screen";
import { useAuth } from "@/providers/AuthProvider";
import {
  WEB_CONTACT_URL,
  WEB_ONBOARDING_STUDENT_URL,
  WEB_PREVIEW_SIGN_IN_URL,
} from "@/core/config/website";
import { colors, spacing, typography } from "@/shared/constants/theme";
import { routes } from "@/core/navigation/routes";

export default function CompleteOnWebScreen() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const displayName = profile?.first_name || profile?.name || user?.email || "your account";

  return (
    <Screen>
      <View style={styles.root}>
        <Text style={styles.emoji}>🎯</Text>
        <Text style={styles.title}>Finish setup on the website</Text>
        <Text style={styles.body}>
          You signed in as <Text style={styles.strong}>{displayName}</Text>. Student onboarding runs on
          edublast.in once — then this app works with the same Google account.
        </Text>

        <Card elevated style={styles.card}>
          <Button
            label="Continue profile on edublast.in"
            onPress={() => void Linking.openURL(WEB_ONBOARDING_STUDENT_URL)}
          />
          <Button
            label="I finished — refresh"
            variant="secondary"
            onPress={() => {
              void refreshProfile().then(() => router.replace(routes.home));
            }}
          />
          <Button label="Sign out" variant="secondary" onPress={() => void signOut()} />
        </Card>

        <Text style={styles.hint}>
          Approved but stuck? Open the website sign-in page and use the same Google email you were
          approved with.
        </Text>
        <Text style={styles.link} onPress={() => void Linking.openURL(WEB_PREVIEW_SIGN_IN_URL)}>
          Open website sign-in
        </Text>
        <Text style={styles.link} onPress={() => void Linking.openURL(WEB_CONTACT_URL)}>
          Contact support
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "center",
    gap: spacing.md,
  },
  emoji: {
    fontSize: 40,
    textAlign: "center",
  },
  title: {
    color: colors.textStrong,
    fontSize: typography.title,
    fontWeight: "800",
    textAlign: "center",
  },
  body: {
    color: colors.textMuted,
    fontSize: typography.bodyLarge,
    lineHeight: 24,
    textAlign: "center",
  },
  strong: {
    color: colors.text,
    fontWeight: "700",
  },
  card: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  hint: {
    color: colors.textDim,
    fontSize: typography.caption,
    lineHeight: 18,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  link: {
    color: colors.accentLight,
    fontSize: typography.body,
    fontWeight: "600",
    textAlign: "center",
    textDecorationLine: "underline",
  },
});
