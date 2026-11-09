import type { Metadata } from "next";
import { RefundPolicyContent } from "@/components/legal/refund-policy-content";

export const metadata: Metadata = {
  title: "Refund Policy",
  description:
    "EduBlast refund policy for paid subscriptions. Public page, no sign-in required.",
  alternates: {
    canonical: "https://edublast.in/terms-conditions/refund-policy",
  },
  openGraph: {
    title: "Refund Policy | EduBlast",
    description:
      "EduBlast refund policy for paid subscriptions. Public page, no sign-in required.",
    url: "https://edublast.in/terms-conditions/refund-policy",
    type: "website",
    images: [
      {
        url: "https://edublast.in/images/logo-2.png",
        width: 1200,
        height: 630,
        alt: "Refund Policy | EduBlast",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Refund Policy | EduBlast",
    description:
      "EduBlast refund policy for paid subscriptions. Public page, no sign-in required.",
    images: ["https://edublast.in/images/logo-2.png"],
  },
};

export default function RefundPolicyPage() {
  return <RefundPolicyContent />;
}
