import { Redirect } from "expo-router";
import { useAuth } from "@/providers/AuthProvider";
import { routes } from "@/core/navigation/routes";

export default function Index() {
  const { isAuthenticated, isLoading, needsWebOnboarding } = useAuth();

  if (isLoading) return null;

  if (isAuthenticated && needsWebOnboarding) {
    return <Redirect href={routes.completeOnWeb} />;
  }

  if (isAuthenticated) {
    return <Redirect href={routes.home} />;
  }

  return <Redirect href={routes.signIn} />;
}
