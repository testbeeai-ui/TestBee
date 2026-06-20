import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Join the Waitlist & Ambassador Program",
  description:
    "Secure your early access spot. Join India's learning social network for PUC & JEE. Sign up for the student waitlist or apply to be a paid student ambassador.",
  alternates: {
    canonical: "https://edublast.in/waitlist",
  },
  openGraph: {
    title: "Join the Waitlist & Ambassador Program | EduBlast",
    description:
      "Secure your early access spot. Join India's learning social network for PUC & JEE. Sign up for the student waitlist or apply to be a paid student ambassador.",
    url: "https://edublast.in/waitlist",
    type: "website",
    images: [
      {
        url: "https://edublast.in/images/logo-2.png",
        width: 1200,
        height: 630,
        alt: "Join the Waitlist & Ambassador Program | EduBlast",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Join the Waitlist & Ambassador Program | EduBlast",
    description:
      "Secure your early access spot. Join India's learning social network for PUC & JEE. Sign up for the student waitlist or apply to be a paid student ambassador.",
    images: ["https://edublast.in/images/logo-2.png"],
  },
};

export default function WaitlistLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
