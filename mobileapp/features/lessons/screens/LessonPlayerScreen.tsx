import { useMemo } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { buildLessonPathSegments, parseGradeSlug, slugify } from "@/core/curriculum/slugs";
import type { Subject } from "@/core/domain/curriculum";
import { stripHtml } from "@/core/domain/doubts";
import { lessonsApi } from "@/services/api/lessons.api";
import { useCurriculum } from "@/features/lessons/hooks/useCurriculum";
import { Screen } from "@/shared/components/ui/Screen";
import { Button } from "@/shared/components/ui/Button";
import { colors, spacing } from "@/shared/constants/theme";

type LessonPlayerScreenProps = {
  pathSegments: string[];
};

export function LessonPlayerScreen({ pathSegments }: LessonPlayerScreenProps) {
  const [board, subject, grade, topicSlug, subOrOverview, level] = pathSegments;
  const classLevel = parseGradeSlug(grade ?? "") ?? 12;
  const sub = (subject ?? "physics") as Subject;

  const curriculumQuery = useCurriculum();

  const topicNode = useMemo(() => {
    const nodes = curriculumQuery.data ?? [];
    return nodes.find(
      (n) =>
        n.subject === sub && n.classLevel === classLevel && slugify(n.topic) === topicSlug
    );
  }, [curriculumQuery.data, sub, classLevel, topicSlug]);

  const topicTitle = topicNode?.topic ?? topicSlug?.replace(/-/g, " ") ?? "Lesson";

  const contentQuery = useQuery({
    queryKey: ["lesson", "content", sub, classLevel, topicTitle, level],
    queryFn: () =>
      lessonsApi.getTopicContent({
        board: board ?? "cbse",
        subject: sub,
        classLevel,
        topic: topicTitle,
        level: (level as "basics") ?? "basics",
      }),
    enabled: Boolean(topicTitle),
  });

  const isOverview = subOrOverview === "overview";

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.subject}>
          {sub} · Class {classLevel}
        </Text>
        <Text style={styles.title}>{topicTitle}</Text>
        {topicNode?.chapterTitle ? (
          <Text style={styles.chapter}>{topicNode.chapterTitle}</Text>
        ) : null}

        {contentQuery.isLoading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
        ) : contentQuery.data?.exists ? (
          <View style={styles.section}>
            {contentQuery.data.whyStudy ? (
              <>
                <Text style={styles.sectionTitle}>Why study this?</Text>
                <Text style={styles.body}>{stripHtml(contentQuery.data.whyStudy)}</Text>
              </>
            ) : null}
            {contentQuery.data.whatLearn ? (
              <>
                <Text style={styles.sectionTitle}>What you'll learn</Text>
                <Text style={styles.body}>{stripHtml(contentQuery.data.whatLearn)}</Text>
              </>
            ) : null}
          </View>
        ) : (
          <Text style={styles.muted}>
            Lesson content is loading or not yet available for this topic.
          </Text>
        )}

        {isOverview && topicNode ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Subtopics</Text>
            {topicNode.subtopics.map((st) => (
              <Button
                key={st.name}
                label={st.name.slice(0, 80)}
                variant="secondary"
                containerStyle={styles.subBtn}
                onPress={() => {
                  const segs = buildLessonPathSegments(sub, classLevel, topicNode.topic, st.name);
                  router.push(`/lesson/${segs.join("/")}` as `/lesson/${string}`);
                }}
              />
            ))}
          </View>
        ) : null}

        <Button label="Ask Prof-Pi (Subject Chat)" onPress={() => router.push("/chatbot")} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  subject: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "800",
  },
  chapter: {
    color: colors.textMuted,
    fontSize: 14,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    marginTop: 8,
  },
  body: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  muted: {
    color: colors.textMuted,
    fontSize: 14,
  },
  subBtn: {
    marginBottom: 8,
  },
});
