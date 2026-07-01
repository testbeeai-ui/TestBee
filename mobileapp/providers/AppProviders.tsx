import type { ReactNode } from "react";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "./AuthProvider";
import { NetworkProvider } from "./NetworkProvider";
import { PushNotificationsProvider } from "./PushNotificationsProvider";
import { QueryProvider } from "./QueryProvider";
import { OfflineBanner } from "@/shared/components/layout/OfflineBanner";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SafeAreaProvider>
      <QueryProvider>
        <AuthProvider>
          <PushNotificationsProvider>
            <NetworkProvider>
              <View style={{ flex: 1 }}>
                <OfflineBanner />
                {children}
              </View>
            </NetworkProvider>
          </PushNotificationsProvider>
        </AuthProvider>
      </QueryProvider>
    </SafeAreaProvider>
  );
}
