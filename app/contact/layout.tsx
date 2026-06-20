import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact Support & Institutional Partnerships",
  description:
    "Need help with your student account, RDM coins, or EduFund grants? Connect with the EduBlast support desk or explore coaching partnership programs.",
  alternates: {
    canonical: "https://edublast.in/contact",
  },
  openGraph: {
    title: "Contact Support & Institutional Partnerships | EduBlast",
    description:
      "Need help with your student account, RDM coins, or EduFund grants? Connect with the EduBlast support desk or explore coaching partnership programs.",
    url: "https://edublast.in/contact",
    type: "website",
    images: [
      {
        url: "https://edublast.in/images/logo-2.png",
        width: 1200,
        height: 630,
        alt: "Contact Support & Institutional Partnerships | EduBlast",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Contact Support & Institutional Partnerships | EduBlast",
    description:
      "Need help with your student account, RDM coins, or EduFund grants? Connect with the EduBlast support desk or explore coaching partnership programs.",
    images: ["https://edublast.in/images/logo-2.png"],
  },
};

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
