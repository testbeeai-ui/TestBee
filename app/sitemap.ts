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

  // Google and Bing ignore priority and changeFrequency. lastmod is included
  // only when it is the post's real update time.
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/` },
    { url: `${base}/news-blog` },
    { url: `${base}/pricing` },
    { url: `${base}/contact` },
    { url: `${base}/waitlist` },
    { url: `${base}/terms-conditions` },
    { url: `${base}/terms-conditions/terms-and-conditions` },
    { url: `${base}/terms-conditions/privacy-policy` },
  ];

  const articleRoutes: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${base}${postSlugPath(post)}`,
    lastModified: post.updatedAt || post.publishDate || post.createdAt,
  }));

  return [...staticRoutes, ...articleRoutes];
}
