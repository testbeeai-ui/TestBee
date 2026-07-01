/** Typed route helpers for Expo Router deep links */
export const routes = {
  welcome: "/(auth)/welcome",
  signIn: "/(auth)/sign-in",
  completeOnWeb: "/(auth)/complete-on-web",
  home: "/(tabs)/home",
  learn: "/(tabs)/learn",
  gyan: "/(tabs)/gyan",
  earn: "/(tabs)/earn",
  profile: "/(tabs)/profile",
  chatbot: "/chatbot",
  edufund: "/edufund",
  news: "/news",
  blogs: "/blogs",
  notifications: "/notifications",
  settings: "/settings",
  doubtDetail: (id: string) => `/gyan/${id}` as const,
} as const;
