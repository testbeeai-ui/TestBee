import type { Metadata } from "next";
import TermsClientLayout from "./TermsClientLayout";

export const metadata: Metadata = {
  title: "Trust, Compliance & Privacy Hub",
  description:
    "Review our platform usage terms, RDM reward rules, and DPDP Act 2023 privacy frameworks. Designed for secure, minor-safe digital education in India.",
  alternates: {
    canonical: "https://edublast.in/terms-conditions",
  },
  openGraph: {
    title: "Trust, Compliance & Privacy Hub | EduBlast",
    description:
      "Review our platform usage terms, RDM reward rules, and DPDP Act 2023 privacy frameworks. Designed for secure, minor-safe digital education in India.",
    url: "https://edublast.in/terms-conditions",
    type: "website",
    images: [
      {
        url: "https://edublast.in/images/logo-2.png",
        width: 1200,
        height: 630,
        alt: "Trust, Compliance & Privacy Hub | EduBlast",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Trust, Compliance & Privacy Hub | EduBlast",
    description:
      "Review our platform usage terms, RDM reward rules, and DPDP Act 2023 privacy frameworks. Designed for secure, minor-safe digital education in India.",
    images: ["https://edublast.in/images/logo-2.png"],
  },
};

export default function TermsConditionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <TermsClientLayout>{children}</TermsClientLayout>;
}
