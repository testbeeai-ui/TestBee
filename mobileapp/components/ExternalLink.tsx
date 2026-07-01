import * as WebBrowser from "expo-web-browser";
import type { PropsWithChildren } from "react";
import { Linking, Platform, Text, type TextProps } from "react-native";

type ExternalLinkProps = PropsWithChildren<TextProps & { href: string }>;

export function ExternalLink({ href, children, onPress, ...props }: ExternalLinkProps) {
  return (
    <Text
      accessibilityRole="link"
      {...props}
      onPress={(event) => {
        onPress?.(event);
        if (Platform.OS !== "web") {
          void WebBrowser.openBrowserAsync(href);
          return;
        }
        void Linking.openURL(href);
      }}
    >
      {children}
    </Text>
  );
}
