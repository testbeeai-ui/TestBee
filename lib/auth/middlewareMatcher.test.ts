import { describe, it, expect } from "vitest";
import { config } from "@/middleware";

/**
 * The matcher is the only thing standing between the middleware and every asset
 * request, so assert the real exported pattern rather than a retyped copy.
 */
const matcher = Array.isArray(config.matcher) ? config.matcher : [config.matcher];
const patterns = matcher.map((m) => new RegExp(`^${m}$`));

function runsMiddleware(pathname: string): boolean {
  return patterns.some((re) => re.test(pathname));
}

describe("middleware matcher", () => {
  it.each([
    "/",
    "/dive",
    "/dashboard",
    "/onboarding",
    "/api/user/bits-attempts",
    "/cbse/physics/11/unit-1/motion/advanced",
  ])("guards %s", (pathname) => {
    expect(runsMiddleware(pathname)).toBe(true);
  });

  it.each([
    "/_next/static/chunks/main.js",
    "/_next/image",
    "/_next/data/build/page.json",
    "/favicon.ico",
    "/logo.png",
    "/hero.svg",
    "/photo.jpeg",
    "/anim.gif",
    "/shot.webp",
    "/shot.avif",
    "/fonts/inter.woff2",
    "/fonts/inter.woff",
    "/fonts/inter.ttf",
    "/styles/main.css",
    "/preview.html",
    "/robots.txt",
    "/sitemap.xml",
    "/manifest.webmanifest",
    "/clip.mp4",
    "/audio.mp3",
    "/doc.pdf",
  ])("skips %s", (pathname) => {
    expect(runsMiddleware(pathname)).toBe(false);
  });
});
