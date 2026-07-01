import Constants from "expo-constants";

/** Remote push is not available in Expo Go (SDK 53+). Use a dev build or EAS preview APK. */
export function supportsRemotePush(): boolean {
  return Constants.appOwnership !== "expo";
}
