import type { Metadata } from "next";
import { TermsAndConditionsContent } from "@/components/legal/terms-and-conditions-content";

export const metadata: Metadata = {
  title: "Terms and Conditions",
  description:
    "Terms and conditions of service, user eligibility, account rules, subscription terms, and RDM coin policies.",
  alternates: {
    canonical: "https://edublast.in/terms-conditions/terms-and-conditions",
  },
  openGraph: {
    title: "Terms and Conditions | EduBlast",
    description:
      "Terms and conditions of service, user eligibility, account rules, subscription terms, and RDM coin policies.",
    url: "https://edublast.in/terms-conditions/terms-and-conditions",
    type: "website",
    images: [
      {
        url: "https://edublast.in/images/logo-2.png",
        width: 1200,
        height: 630,
        alt: "Terms and Conditions | EduBlast",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Terms and Conditions | EduBlast",
    description:
      "Terms and conditions of service, user eligibility, account rules, subscription terms, and RDM coin policies.",
    images: ["https://edublast.in/images/logo-2.png"],
  },
};

export default function TermsAndConditionsPage() {
  return <TermsAndConditionsContent />;
}
