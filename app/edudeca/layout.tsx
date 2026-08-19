import type { Metadata } from "next";

const TITLE = "EduDeca";
const DESCRIPTION = "EduDeca on EduBlast for Class 11 and Class 12.";
const CANONICAL = "https://edublast.in/edudeca";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: CANONICAL,
  },
  openGraph: {
    title: `${TITLE} | EduBlast`,
    description: DESCRIPTION,
    url: CANONICAL,
    type: "website",
    images: [
      {
        url: "https://edublast.in/images/logo-2.png",
        width: 1200,
        height: 630,
        alt: `${TITLE} | EduBlast`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${TITLE} | EduBlast`,
    description: DESCRIPTION,
    images: ["https://edublast.in/images/logo-2.png"],
  },
};

export default function EduDecaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
