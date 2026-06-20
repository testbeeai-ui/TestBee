import type { MetadataRoute } from "next";
import { getPublicPostsServer } from "@/lib/news-blog/server-loader";
import { postSlugPath } from "@/app/news-blog/slug";

function siteBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteBaseUrl();
  const posts = await getPublicPostsServer();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/news-blog`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/pricing`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/contact`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/waitlist`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/terms-conditions`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/terms-conditions/terms-and-conditions`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/terms-conditions/privacy-policy`, changeFrequency: "monthly", priority: 0.3 },
  ];

  const articleRoutes: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${base}${postSlugPath(post)}`,
    lastModified: post.updatedAt || post.publishDate || post.createdAt,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [...staticRoutes, ...articleRoutes];
}
