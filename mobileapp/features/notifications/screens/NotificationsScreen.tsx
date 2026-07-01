import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { mapNotificationActionPath } from "@/core/navigation/mapNotificationAction";
import { useAuth } from "@/providers/AuthProvider";
import { useMotivationNotifications } from "@/features/notifications/hooks/useMotivationNotifications";
import type { StudentNotification } from "@/core/domain/notifications";
import { Screen } from "@/shared/components/ui/Screen";
import { colors, spacing } from "@/shared/constants/theme";
import { formatTimeAgo } from "@/core/domain/doubts";

export function NotificationsScreen() {
  const { user } = useAuth();
  const { notifications, unreadCount, seenIds, markSeen, isLoading } = useMotivationNotifications(
    user?.id
  );
  const [selected, setSelected] = useState<StudentNotification | null>(null);
  const [tab, setTab] = useState<"unread" | "read">("unread");

  const items = useMemo(() => {
    return notifications
      .map((n) => ({ ...n, read: seenIds.has(n.id) }))
      .filter((n) => (tab === "unread" ? !n.read : n.read));
  }, [notifications, seenIds, tab]);

  const openNotificationAction = (notification: StudentNotification) => {
    const mapped = mapNotificationActionPath(notification.actionPath);
    setSelected(null);
    if (!mapped) return;
    if (mapped.kind === "route") {
      router.push(mapped.href as never);
      return;
    }
    void Linking.openURL(mapped.url);
  };

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Notifications</Text>
        {unreadCount > 0 ? <Text style={styles.badge}>{unreadCount} new</Text> : null}
      </View>

      <View style={styles.tabs}>
        <Pressable onPress={() => setTab("unread")} style={[styles.tab, tab === "unread" && styles.tabActive]}>
          <Text style={[styles.tabText, tab === "unread" && styles.tabTextActive]}>Unread</Text>
        </Pressable>
        <Pressable onPress={() => setTab("read")} style={[styles.tab, tab === "read" && styles.tabActive]}>
          <Text style={[styles.tabText, tab === "read" && styles.tabTextActive]}>Read</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => n.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                void markSeen(item.id);
                setSelected(item);
              }}
              style={styles.card}
            >
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.preview} numberOfLines={2}>
                {item.preview}
              </Text>
              <Text style={styles.time}>{formatTimeAgo(item.createdAt)}</Text>
            </Pressable>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {tab === "unread" ? "No unread notifications." : "No read notifications yet."}
            </Text>
          }
        />
      )}

      <Modal visible={Boolean(selected)} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{selected?.title}</Text>
            <Pressable onPress={() => setSelected(null)}>
              <Text style={styles.close}>Close</Text>
            </Pressable>
          </View>
          <Text style={styles.modalBody}>{selected?.body}</Text>
          {selected?.rdmDelta ? (
            <Text style={styles.rdm}>+{selected.rdmDelta} RDM opportunity</Text>
          ) : null}
          {selected?.actionPath ? (
            <Pressable onPress={() => openNotificationAction(selected!)} style={styles.actionBtn}>
              <Text style={styles.actionBtnText}>Open related activity</Text>
            </Pressable>
          ) : null}
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
  },
  badge: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "700",
  },
  tabs: {
    flexDirection: "row",
    paddingHorizontal: spacing.md,
    gap: 8,
    marginBottom: spacing.sm,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  tabText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
  },
  tabTextActive: {
    color: colors.accent,
  },
  list: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  sep: { height: 8 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 4,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  preview: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  time: {
    color: colors.textMuted,
    fontSize: 12,
  },
  empty: {
    color: colors.textMuted,
    textAlign: "center",
    padding: spacing.lg,
  },
  modal: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.md,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.md,
    gap: 12,
  },
  modalTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
  },
  close: {
    color: colors.accent,
    fontSize: 16,
  },
  modalBody: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
  },
  rdm: {
    marginTop: spacing.md,
    color: colors.accent,
    fontWeight: "700",
  },
  actionBtn: {
    marginTop: spacing.md,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.accentMuted,
    alignItems: "center",
  },
  actionBtnText: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: "700",
  },
});
