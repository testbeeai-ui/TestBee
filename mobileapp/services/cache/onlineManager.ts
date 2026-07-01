import NetInfo from "@react-native-community/netinfo";
import { onlineManager } from "@tanstack/react-query";

/** Sync TanStack Query online state with device connectivity. */
export function setupOnlineManager(): void {
  onlineManager.setEventListener((setOnline) => {
    return NetInfo.addEventListener((state) => {
      setOnline(Boolean(state.isConnected && state.isInternetReachable !== false));
    });
  });
}
