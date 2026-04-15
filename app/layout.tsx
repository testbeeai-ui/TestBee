import type { Metadata } from "next";
import { Caveat, Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";
import "katex/dist/katex.min.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** App-wide font (non-landing UI). */
const appSans = Playfair_Display({
  variable: "--font-app-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

/** Investor landing: display serif + script accent (hero mockups). */
const landingSerif = Playfair_Display({
  variable: "--font-landing-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

const landingScript = Caveat({
  variable: "--font-landing-script",
  subsets: ["latin"],
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  title: "EduBlast — Learn. Play. Conquer.",
  description: "Fire questions, earn RDM, and blast through your syllabus with byte-sized learning!",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${appSans.variable} ${landingSerif.variable} ${landingScript.variable} antialiased`}
        suppressHydrationWarning
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
