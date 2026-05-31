import type { MetadataRoute } from "next";

function siteBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export default function robots(): MetadataRoute.Robots {
  const base = siteBaseUrl();
  return {
    rules: {
      userAgent: "*",
      allow: [
        "/",
        "/news-blog",
        "/pricing",
        "/contact",
        "/terms-conditions"
      ],
      disallow: [
        "/admin",
        "/api",
        "/auth",
        "/auth-choice",
        "/classroom",
        "/classrooms",
        "/onboarding",
        "/select-role",
        "/buddy-join",
        "/home",
        "/profile",
        "/settings",
        "/performance",
        "/play",
        "/revision",
        "/refer-earn",
        "/teacher-portal",
        "/user",
        "/explore",
        "/explore-1",
        "/doubts",
        "/magic-wall",
        "/edufund",
        "/exam-prep",
        "/mock-test",
        "/mock"
      ]
    },
    sitemap: `${base}/sitemap.xml`,
  };
}

