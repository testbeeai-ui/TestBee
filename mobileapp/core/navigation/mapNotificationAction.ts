import { routes } from "./routes";

export type MappedNotificationAction =
  | { kind: "route"; href: string }
  | { kind: "web"; url: string };

const WEB_BASE = "https://www.edublast.in";

/** Map website notification paths to in-app routes or web fallback. */
export function mapNotificationActionPath(actionPath: string | null): MappedNotificationAction | null {
  if (!actionPath?.trim()) return null;
  const path = actionPath.trim();

  if (path === routes.home || path === "/(tabs)/home" || path.startsWith("/dashboard")) {
    return { kind: "route", href: routes.home };
  }
  if (path.includes("/gyan") || path.includes("/explore")) {
    return { kind: "route", href: routes.gyan };
  }
  if (path.includes("/learn") || path.includes("/lessons") || path.includes("/topic-content")) {
    return { kind: "route", href: routes.learn };
  }
  if (path.includes("/earn") || path.includes("/buddy") || path.includes("/refer")) {
    return { kind: "route", href: routes.earn };
  }
  if (path.includes("/chatbot") || path.includes("/subject-chat")) {
    return { kind: "route", href: routes.chatbot };
  }
  if (path.includes("/edufund")) {
    return { kind: "route", href: routes.edufund };
  }
  if (path.includes("/news")) {
    return { kind: "route", href: routes.news };
  }
  if (path.includes("/blogs")) {
    return { kind: "route", href: routes.blogs };
  }
  if (path.includes("/profile")) {
    return { kind: "route", href: routes.profile };
  }
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return { kind: "web", url: path };
  }
  if (path.startsWith("/")) {
    return { kind: "web", url: `${WEB_BASE}${path}` };
  }
  return null;
}
