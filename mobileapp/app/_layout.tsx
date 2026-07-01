import { DarkTheme, ThemeProvider } from "expo-router";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";

import { AppProviders } from "@/providers/AppProviders";
import { useAuth } from "@/providers/AuthProvider";
import { colors } from "@/shared/constants/theme";

export { ErrorBoundary } from "expo-router";

SplashScreen.preventAutoHideAsync();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    primary: colors.accent,
  },
};

export default function RootLayout() {
  return (
    <AppProviders>
      <RootLayoutNav />
    </AppProviders>
  );
}

function RootLayoutNav() {
  const { isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      void SplashScreen.hideAsync();
    }
  }, [isLoading]);

  if (isLoading) return null;

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="chatbot/index" options={{ title: "Subject Chat" }} />
        <Stack.Screen name="edufund/index" options={{ title: "EduFund" }} />
        <Stack.Screen name="edufund/[id]" options={{ title: "Proposal" }} />
        <Stack.Screen name="news/index" options={{ title: "News" }} />
        <Stack.Screen name="news/[id]" options={{ title: "Article" }} />
        <Stack.Screen name="blogs/index" options={{ title: "Blogs" }} />
        <Stack.Screen name="blogs/[id]" options={{ title: "Article" }} />
        <Stack.Screen name="notifications/index" options={{ title: "Notifications" }} />
        <Stack.Screen name="settings/index" options={{ title: "Settings" }} />
        <Stack.Screen name="gyan/[id]" options={{ title: "Doubt" }} />
        <Stack.Screen name="lesson/[...path]" options={{ title: "Lesson" }} />
      </Stack>
    </ThemeProvider>
  );
}
