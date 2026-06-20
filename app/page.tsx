import type { Metadata } from "next";
import LandingPageClient from "./LandingPageClient";

export const metadata: Metadata = {
  title: "EduBlast — Learning that feels like scrolling, but builds exam winners",
  description:
    "Join India's AI-powered learning social network for PUC & JEE. Ask doubts to Gyan++, conquer adaptive Testbee mocks, track streaks, and earn RDM rewards while you learn!",
  alternates: {
    canonical: "https://edublast.in",
  },
  openGraph: {
    title: "EduBlast — Learning that feels like scrolling, but builds exam winners",
    description:
      "Join India's AI-powered learning social network for PUC & JEE. Ask doubts to Gyan++, conquer adaptive Testbee mocks, track streaks, and earn RDM rewards while you learn!",
    url: "https://edublast.in",
    siteName: "EduBlast",
    type: "website",
    images: [
      {
        url: "https://edublast.in/images/logo-2.png",
        width: 1200,
        height: 630,
        alt: "EduBlast — Learning that feels like scrolling, but builds exam winners",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "EduBlast — Learning that feels like scrolling, but builds exam winners",
    description:
      "Join India's AI-powered learning social network for PUC & JEE. Ask doubts to Gyan++, conquer adaptive Testbee mocks, track streaks, and earn RDM rewards while you learn!",
    images: ["https://edublast.in/images/logo-2.png"],
  },
};

export default function LandingPage() {
  return <LandingPageClient />;
}
