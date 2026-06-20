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
  title: {
    default: "EduBlast — India's AI-Powered Learning Social Network",
    template: "%s | EduBlast",
  },
  description:
    "Gamify your PUC & JEE prep. Ask doubts to AI, solve adaptive mocks, earn RDM coins, and unlock EduFund scholarship grants with byte-sized learning!",
  openGraph: {
    title: "EduBlast — India's AI-Powered Learning Social Network",
    description:
      "Gamify your PUC & JEE prep. Ask doubts to AI, solve adaptive mocks, earn RDM coins, and unlock EduFund scholarship grants with byte-sized learning!",
    type: "website",
    locale: "en_IN",
    url: "https://edublast.in",
    siteName: "EduBlast",
    images: [
      {
        url: "https://edublast.in/images/logo-2.png",
        width: 1200,
        height: 630,
        alt: "EduBlast Learning Social Network",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "EduBlast — India's AI-Powered Learning Social Network",
    description:
      "Gamify your PUC & JEE prep. Ask doubts to AI, solve adaptive mocks, earn RDM coins, and unlock EduFund scholarship grants with byte-sized learning!",
    images: ["https://edublast.in/images/logo-2.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="antialiased" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
