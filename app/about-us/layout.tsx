import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "Why EduBlast exists: a habit engine for Class XI–XII learning, built around community, curiosity, daily rewards, and EduFundz.",
  alternates: {
    canonical: "https://edublast.in/about-us",
  },
  openGraph: {
    title: "About Us | EduBlast",
    description:
      "Why EduBlast exists: a habit engine for Class XI–XII learning, built around community, curiosity, daily rewards, and EduFundz.",
    url: "https://edublast.in/about-us",
    type: "website",
    images: [
      {
        url: "https://edublast.in/images/logo-2.png",
        width: 1200,
        height: 630,
        alt: "About Us | EduBlast",
      },
    ],
  },
};

export default function AboutUsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
