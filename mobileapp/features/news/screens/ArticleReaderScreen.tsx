import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { stripArticleHtml } from "@/core/domain/newsBlog";
import { useNewsBlogArticle } from "@/features/news/hooks/useNewsBlogPosts";
import { Screen } from "@/shared/components/ui/Screen";
import { colors, spacing } from "@/shared/constants/theme";

type ArticleReaderProps = {
  portal: "news" | "blog";
};

export function ArticleReaderScreen({ portal }: ArticleReaderProps) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { post, isLoading } = useNewsBlogArticle(portal, id);

  if (isLoading) {
    return (
      <Screen>
        <Text style={styles.muted}>Loading…</Text>
      </Screen>
    );
  }

  if (!post) {
    return (
      <Screen>
        <Text style={styles.error}>Article not found</Text>
      </Screen>
    );
  }

  const body =
    post.contentFormat === "html" && post.rawHtml
      ? stripArticleHtml(post.rawHtml)
      : post.body || post.summary;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{post.title}</Text>
        <Text style={styles.meta}>
          {post.author} · {new Date(post.publishDate).toLocaleDateString()}
        </Text>
        {post.summary ? <Text style={styles.summary}>{post.summary}</Text> : null}
        <Text style={styles.body}>{body}</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 30,
  },
  meta: {
    color: colors.textMuted,
    fontSize: 13,
  },
  summary: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    fontStyle: "italic",
  },
  body: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 26,
  },
  muted: {
    color: colors.textMuted,
  },
  error: {
    color: colors.danger,
  },
});
