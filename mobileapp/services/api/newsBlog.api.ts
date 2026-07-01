import type { NewsBlogPost } from "@/core/domain/newsBlog";
import { apiJson } from "./client";

export const newsBlogApi = {
  listPosts: () => apiJson<{ posts: NewsBlogPost[] }>("/api/news-blog-posts"),
};
