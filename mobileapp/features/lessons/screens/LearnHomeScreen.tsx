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
import type { ClassLevel, Subject, TopicNode } from "@/core/domain/curriculum";
import { buildLessonPathSegments } from "@/core/curriculum/slugs";
import { Screen } from "@/shared/components/ui/Screen";
import { colors, spacing } from "@/shared/constants/theme";
import { SubjectPicker } from "../components/SubjectPicker";
import { useCurriculum } from "../hooks/useCurriculum";

function openTopic(node: TopicNode) {
  const firstSub = node.subtopics[0]?.name;
  const segments = buildLessonPathSegments(node.subject, node.classLevel, node.topic, firstSub);
  router.push(`/lesson/${segments.join("/")}` as `/lesson/${string}`);
}

export function LearnHomeScreen() {
  const { data, isLoading, isError, refetch } = useCurriculum();
  const [subject, setSubject] = useState<Subject>("physics");
  const [classLevel, setClassLevel] = useState<ClassLevel>(12);

  const topics = useMemo(() => {
    return (data ?? []).filter((n) => n.subject === subject && n.classLevel === classLevel);
  }, [data, subject, classLevel]);

  return (
    <Screen padded={false}>
      <View style={styles.filters}>
        <SubjectPicker value={subject} onChange={setSubject} />
        <View style={styles.levelRow}>
          {([11, 12] as ClassLevel[]).map((lvl) => (
            <Pressable
              key={lvl}
              onPress={() => setClassLevel(lvl)}
              style={[styles.levelChip, classLevel === lvl && styles.levelChipActive]}
            >
              <Text style={[styles.levelText, classLevel === lvl && styles.levelTextActive]}>
                Class {lvl}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Text style={styles.error}>Could not load curriculum.</Text>
          <Pressable onPress={() => void refetch()}>
            <Text style={styles.retry}>Tap to retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={topics}
          keyExtractor={(item, index) => `${item.topic}-${item.chapterTitle}-${index}`}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => openTopic(item)}
              style={({ pressed }) => [styles.topicCard, pressed && { opacity: 0.9 }]}
            >
              <Text style={styles.topicTitle} numberOfLines={2}>
                {item.topic}
              </Text>
              <Text style={styles.chapter} numberOfLines={1}>
                {item.chapterTitle}
              </Text>
              <Text style={styles.subCount}>
                {item.subtopics.length} subtopic{item.subtopics.length === 1 ? "" : "s"}
              </Text>
            </Pressable>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No topics found for this filter.</Text>}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: {
    padding: spacing.md,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  levelRow: {
    flexDirection: "row",
    gap: 8,
  },
  levelChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  levelChipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  levelText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
  },
  levelTextActive: {
    color: colors.accent,
  },
  list: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  sep: {
    height: 8,
  },
  topicCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 4,
  },
  topicTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  chapter: {
    color: colors.textMuted,
    fontSize: 13,
  },
  subCount: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "600",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  error: {
    color: colors.danger,
  },
  retry: {
    color: colors.accent,
  },
  empty: {
    color: colors.textMuted,
    textAlign: "center",
    padding: spacing.lg,
  },
});
