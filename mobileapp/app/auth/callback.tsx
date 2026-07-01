import { Redirect } from "expo-router";
import { routes } from "@/core/navigation/routes";

/** Deep link: edublast://auth/callback — session exchanged in signInWithGoogle. */
export default function OAuthCallbackRoute() {
  return <Redirect href={routes.home} />;
}
