import Link from "next/link";
import { BLOG_SECTIONS, getPublicNewsSections } from "../constants";
import { feedCardBlurb } from "../html-feed-and-seo";
import { getSectionLabel } from "../post-draft-utils";
import { buildArticleHref } from "../nav-query";
import type { Post } from "../types";

/** Crawlable index markup — visually hidden; mirrors public post list for search engines. */
export function NewsBlogSeoIndex({ posts }: { posts: Post[] }) {
  const news = posts.filter((p) => p.portal === "news");
  const blog = posts.filter((p) => p.portal === "blog");

  return (
    <section className="sr-only" aria-label="News and blog index">
      <h1>News &amp; Blogs — EduBlast</h1>
      <p>
        Exam updates, key dates, results, preparation tips, topper stories, and revision guides for
        JEE, board exams, and state CET aspirants.
      </p>

      <h2>News</h2>
      {getPublicNewsSections().map((section) => {
        const sectionPosts = news.filter((p) => p.section === section.id);
        if (sectionPosts.length === 0) return null;
        return (
          <section key={section.id}>
            <h3>{section.label}</h3>
            <ul>
              {sectionPosts.map((post) => (
                <li key={post.id}>
                  <article>
                    <h4>
                      <Link href={buildArticleHref(post)}>{post.title}</Link>
                    </h4>
                    <p>{feedCardBlurb(post)}</p>
                    <p>
                      {getSectionLabel(post.section)} ·{" "}
                      <time dateTime={post.publishDate || post.createdAt}>
                        {post.publishDate || post.createdAt}
                      </time>
                      {post.author ? ` · ${post.author}` : ""}
                    </p>
                  </article>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <h2>Blogs</h2>
      {BLOG_SECTIONS.map((section) => {
        const sectionPosts = blog.filter((p) => p.section === section.id);
        if (sectionPosts.length === 0) return null;
        return (
          <section key={section.id}>
            <h3>{section.label}</h3>
            <ul>
              {sectionPosts.map((post) => (
                <li key={post.id}>
                  <article>
                    <h4>
                      <Link href={buildArticleHref(post)}>{post.title}</Link>
                    </h4>
                    <p>{feedCardBlurb(post)}</p>
                    <p>
                      {getSectionLabel(post.section)} ·{" "}
                      <time dateTime={post.publishDate || post.createdAt}>
                        {post.publishDate || post.createdAt}
                      </time>
                      {post.author ? ` · ${post.author}` : ""}
                    </p>
                  </article>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </section>
  );
}
