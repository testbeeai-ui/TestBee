import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import "@fontsource-variable/playfair-display/wght-italic.css";
import "@fontsource-variable/playfair-display/wght.css";
import "@fontsource/caveat/600.css";
import "@fontsource/caveat/700.css";
import { Providers } from "./providers";
import "./globals.css";
import "katex/dist/katex.min.css";

/** Geist uses bundled .woff2 via `geist` — no Google Fonts fetch at build time (offline CI). */

export const metadata: Metadata = {
  title: "EduBlast — Learn. Play. Conquer.",
  description:
    "Fire questions, earn RDM, and blast through your syllabus with byte-sized learning!",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
