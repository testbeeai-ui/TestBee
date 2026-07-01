import { useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/shared/components/ui/Screen";
import { Button } from "@/shared/components/ui/Button";
import { colors, spacing } from "@/shared/constants/theme";
import { routes } from "@/core/navigation/routes";
import { DoubtFeedCard } from "../components/DoubtFeedCard";
import { AskDoubtSheet } from "../components/AskDoubtSheet";
import { useDoubtFeed } from "../hooks/useDoubtFeed";

export function GyanFeedScreen() {
  const { data, isLoading, isError, refetch, isRefetching } = useDoubtFeed();
  const [askOpen, setAskOpen] = useState(false);

  return (
    <Screen padded={false}>
      <View style={styles.toolbar}>
        <Text style={styles.title}>Gyan++</Text>
        <Button label="Ask" onPress={() => setAskOpen(true)} />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Text style={styles.error}>Could not load doubts.</Text>
          <Button label="Retry" variant="secondary" onPress={() => void refetch()} />
        </View>
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(item) => item.id}
          refreshing={isRefetching}
          onRefresh={() => void refetch()}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          renderItem={({ item }) => (
            <DoubtFeedCard
              doubt={item}
              onPress={() => router.push(routes.doubtDetail(item.id))}
            />
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>No doubts yet. Be the first to ask!</Text>
          }
        />
      )}

      <AskDoubtSheet
        visible={askOpen}
        onClose={() => setAskOpen(false)}
        onPosted={(id) => {
          void refetch();
          router.push(routes.doubtDetail(id));
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
  },
  list: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  sep: {
    height: 10,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: spacing.md,
  },
  error: {
    color: colors.danger,
    textAlign: "center",
  },
  empty: {
    color: colors.textMuted,
    textAlign: "center",
    padding: spacing.lg,
  },
});
