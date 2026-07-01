import { useQuery } from "@tanstack/react-query";
import type { NewsBlogPost } from "@/core/domain/newsBlog";
import { newsBlogApi } from "@/services/api/newsBlog.api";
import { queryKeys, queryStaleTimes } from "@/services/cache/queryKeys";

/** Single cached fetch for all news + blog posts (shared across portals and article reader). */
export function useNewsBlogPosts() {
  return useQuery({
    queryKey: queryKeys.newsBlog.all,
    queryFn: async () => {
      const res = await newsBlogApi.listPosts();
      return res.posts;
    },
    staleTime: queryStaleTimes.newsBlog,
  });
}

export function useNewsPosts(): {
  posts: NewsBlogPost[];
  isLoading: boolean;
  isError: boolean;
} {
  const query = useNewsBlogPosts();
  return {
    posts: (query.data ?? []).filter((p) => p.portal === "news"),
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

export function useBlogPosts(): {
  posts: NewsBlogPost[];
  isLoading: boolean;
  isError: boolean;
} {
  const query = useNewsBlogPosts();
  return {
    posts: (query.data ?? []).filter((p) => p.portal === "blog"),
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

export function useNewsBlogArticle(portal: "news" | "blog", id: string | undefined) {
  const query = useNewsBlogPosts();
  const post =
    id && query.data
      ? (query.data.find((p) => p.id === id && p.portal === portal) ?? null)
      : null;

  return {
    post,
    isLoading: query.isLoading && !query.data,
    isError: query.isError,
  };
}
