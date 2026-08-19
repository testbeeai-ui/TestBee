import type { Metadata } from "next";

const BRAND = "EduBlast";
const PAGE = "EduDeca";
const TITLE = `${BRAND} | ${PAGE}`;
const DESCRIPTION = `${PAGE} on ${BRAND} for Class 11 and Class 12.`;
const CANONICAL = "https://edublast.in/edudeca";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: {
    canonical: CANONICAL,
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: CANONICAL,
    type: "website",
    images: [
      {
        url: "https://edublast.in/images/logo-2.png",
        width: 1200,
        height: 630,
        alt: TITLE,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
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
