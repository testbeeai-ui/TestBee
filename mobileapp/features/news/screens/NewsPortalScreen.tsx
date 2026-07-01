import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { NEWS_SECTION_LABELS, type NewsBlogPost } from "@/core/domain/newsBlog";
import { useNewsPosts } from "@/features/news/hooks/useNewsBlogPosts";
import { Screen } from "@/shared/components/ui/Screen";
import { colors, spacing } from "@/shared/constants/theme";
import { formatTimeAgo } from "@/core/domain/doubts";

export function NewsPortalScreen() {
  const [section, setSection] = useState<string | "all">("all");
  const { posts: allPosts, isLoading } = useNewsPosts();

  const sections = useMemo(() => {
    const ids = new Set(allPosts.map((p) => p.section));
    return ["all", ...Array.from(ids)];
  }, [allPosts]);

  const filtered = useMemo(() => {
    if (section === "all") return allPosts;
    return allPosts.filter((p) => p.section === section);
  }, [allPosts, section]);

  const openPost = (post: NewsBlogPost) => {
    router.push(`/news/${post.id}`);
  };

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Text style={styles.title}>News</Text>
      </View>
      <FlatList
        horizontal
        data={sections}
        keyExtractor={(s) => s}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setSection(item)}
            style={[styles.chip, section === item && styles.chipActive]}
          >
            <Text style={[styles.chipText, section === item && styles.chipTextActive]}>
              {item === "all" ? "All" : (NEWS_SECTION_LABELS[item] ?? item)}
            </Text>
          </Pressable>
        )}
      />
      {isLoading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          renderItem={({ item }) => (
            <Pressable onPress={() => openPost(item)} style={styles.card}>
              <Text style={styles.section}>
                {NEWS_SECTION_LABELS[item.section] ?? item.section}
              </Text>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.summary} numberOfLines={2}>
                {item.summary}
              </Text>
              <Text style={styles.meta}>
                {item.author} · {formatTimeAgo(item.publishDate)}
              </Text>
            </Pressable>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No news posts yet.</Text>}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
  },
  chips: {
    paddingHorizontal: spacing.md,
    gap: 8,
    paddingBottom: spacing.sm,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
  },
  chipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  chipText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
  },
  chipTextActive: {
    color: colors.accent,
  },
  list: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  sep: { height: 10 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 6,
  },
  section: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "700",
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  summary: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  meta: {
    color: colors.textMuted,
    fontSize: 12,
  },
  empty: {
    color: colors.textMuted,
    textAlign: "center",
    padding: spacing.lg,
  },
});
