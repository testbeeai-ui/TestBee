import { load } from "@expo/env";
import type { ExpoConfig, ConfigContext } from "expo/config";

load(process.cwd());

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "EduBlast",
  slug: "edublast-student",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "edublast",
  userInterfaceStyle: "automatic",
  ios: {
    supportsTablet: true,
    bundleIdentifier: "in.edublast.student",
  },
  android: {
    package: "in.edublast.student",
    versionCode: 1,
    adaptiveIcon: {
      backgroundColor: "#0c0e14",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: true,
    permissions: ["POST_NOTIFICATIONS"],
  },
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        resizeMode: "contain",
        backgroundColor: "#0c0e14",
      },
    ],
    [
      "expo-notifications",
      {
        icon: "./assets/images/icon.png",
        color: "#22c55e",
        defaultChannel: "default",
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    edublast: {
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
    },
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    EXPO_PUBLIC_API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL,
    eas: {
      projectId: process.env.EAS_PROJECT_ID ?? process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? "",
    },
  },
});
