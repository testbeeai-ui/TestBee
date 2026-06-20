import type { Metadata } from "next";
import PrivacyPolicyBody from "./PrivacyPolicyBody";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "EduBlast Privacy Policy and compliance guidelines under India's DPDP Act 2023.",
  alternates: {
    canonical: "https://edublast.in/terms-conditions/privacy-policy",
  },
  openGraph: {
    title: "Privacy Policy | EduBlast",
    description:
      "EduBlast Privacy Policy and compliance guidelines under India's DPDP Act 2023.",
    url: "https://edublast.in/terms-conditions/privacy-policy",
    type: "website",
    images: [
      {
        url: "https://edublast.in/images/logo-2.png",
        width: 1200,
        height: 630,
        alt: "Privacy Policy | EduBlast",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Privacy Policy | EduBlast",
    description:
      "EduBlast Privacy Policy and compliance guidelines under India's DPDP Act 2023.",
    images: ["https://edublast.in/images/logo-2.png"],
  },
};

export default function PrivacyPolicyPage() {
  return <PrivacyPolicyBody />;
}
