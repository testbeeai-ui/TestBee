import type { Metadata } from "next";
import PricingClient from "./PricingClient";

export const metadata: Metadata = {
  title: "Pricing Plans & Subscriptions",
  description:
    "Upgrade your learning play. Choose from Free, Starter, or Pro plans to unlock Testbee adaptive mocks, Gyan++ doubt solving, and spaced-repetition InstaCue cards.",
  alternates: {
    canonical: "https://edublast.in/pricing",
  },
  openGraph: {
    title: "Pricing Plans & Subscriptions | EduBlast",
    description:
      "Upgrade your learning play. Choose from Free, Starter, or Pro plans to unlock Testbee adaptive mocks, Gyan++ doubt solving, and spaced-repetition InstaCue cards.",
    url: "https://edublast.in/pricing",
    type: "website",
    images: [
      {
        url: "https://edublast.in/images/logo-2.png",
        width: 1200,
        height: 630,
        alt: "Pricing Plans & Subscriptions | EduBlast",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing Plans & Subscriptions | EduBlast",
    description:
      "Upgrade your learning play. Choose from Free, Starter, or Pro plans to unlock Testbee adaptive mocks, Gyan++ doubt solving, and spaced-repetition InstaCue cards.",
    images: ["https://edublast.in/images/logo-2.png"],
  },
};

export default function PricingPage() {
  return <PricingClient />;
}
