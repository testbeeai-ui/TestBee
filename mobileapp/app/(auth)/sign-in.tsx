import { useEffect } from "react";
import { Image, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Badge } from "@/shared/components/ui/Badge";
import { Button } from "@/shared/components/ui/Button";
import { Card } from "@/shared/components/ui/Card";
import { Screen } from "@/shared/components/ui/Screen";
import { useAuth } from "@/providers/AuthProvider";
import { WEB_CONTACT_URL, WEB_PREVIEW_SIGN_IN_URL } from "@/core/config/website";
import { supabaseRedirectAllowListHint } from "@/services/auth/oauthDeepLink";
import { getAppOAuthCallbackUrl } from "@/services/supabase/oauthRedirect";
import { colors, radius, shadows, spacing, typography } from "@/shared/constants/theme";
import { routes } from "@/core/navigation/routes";

export default function SignInScreen() {
  const { signInWithGoogle, isSigningIn, signInStatus, isAuthenticated, needsWebOnboarding, authBlock, clearAuthBlock } =
    useAuth();

  useEffect(() => {
    if (!isAuthenticated) return;
    if (needsWebOnboarding) {
      router.replace(routes.completeOnWeb);
      return;
    }
    router.replace(routes.home);
  }, [isAuthenticated, needsWebOnboarding]);

  return (
    <Screen>
      <View style={styles.root}>
        <View style={styles.logoWrap}>
          <Image source={require("@/assets/images/icon.png")} style={styles.logo} />
        </View>

        <View style={styles.copy}>
          <Badge label="Student app" tone="green" />
          <Text style={styles.title}>Sign in to EduBlast</Text>
          <Text style={styles.subtitle}>
            Tap below — Google opens in a small window, then you return to the app. You should not
            need to use the full website sign-in page.
          </Text>
        </View>

        {authBlock ? (
          <Card style={styles.errorCard}>
            <Text style={styles.errorTitle}>Sign-in blocked</Text>
            <Text style={styles.errorBody}>{authBlock.message}</Text>
            {authBlock.reason === "not_approved" ? (
              <>
                <Button
                  label="Open website sign-in"
                  variant="secondary"
                  onPress={() => void Linking.openURL(WEB_PREVIEW_SIGN_IN_URL)}
                />
                <Button
                  label="Contact support"
                  variant="secondary"
                  onPress={() => void Linking.openURL(WEB_CONTACT_URL)}
                />
              </>
            ) : null}
            <Pressable onPress={clearAuthBlock}>
              <Text style={styles.dismiss}>Dismiss</Text>
            </Pressable>
          </Card>
        ) : null}

        <Card elevated style={styles.card}>
          <Button
            label="Continue with Google"
            loading={isSigningIn}
            onPress={() => void signInWithGoogle()}
          />
          {signInStatus ? <Text style={styles.status}>{signInStatus}</Text> : null}
          {__DEV__ ? (
            <Text style={styles.devHint}>
              App return URL:{"\n"}
              {getAppOAuthCallbackUrl()}
              {"\n\n"}
              {supabaseRedirectAllowListHint()}
            </Text>
          ) : null}
          <Text style={styles.help}>
            Use the Google account approved for EduBlast (same email as the website waitlist).
          </Text>
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "center",
    gap: spacing.lg,
  },
  logoWrap: {
    alignSelf: "center",
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadows.raised,
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: radius.lg,
  },
  copy: {
    alignItems: "center",
    gap: spacing.sm,
  },
  title: {
    color: colors.textStrong,
    fontSize: typography.hero,
    fontWeight: "900",
    textAlign: "center",
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: typography.bodyLarge,
    lineHeight: 24,
    textAlign: "center",
    maxWidth: 320,
  },
  card: {
    gap: spacing.md,
  },
  help: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 18,
    textAlign: "center",
  },
  devHint: {
    color: colors.textDim,
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
  },
  status: {
    color: colors.textMuted,
    fontSize: typography.caption,
    textAlign: "center",
  },
  errorCard: {
    gap: spacing.sm,
    borderColor: colors.danger,
  },
  errorTitle: {
    color: colors.danger,
    fontSize: typography.bodyLarge,
    fontWeight: "700",
  },
  errorBody: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 20,
  },
  dismiss: {
    color: colors.textDim,
    fontSize: typography.caption,
    textAlign: "center",
    marginTop: 4,
  },
});
