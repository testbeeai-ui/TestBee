import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { buildStudentWalletGuide } from "@/core/rdm/studentWalletGuide";
import { colors, spacing } from "@/shared/constants/theme";

type RdmWalletCardProps = {
  balance: number;
};

export function RdmWalletCard({ balance }: RdmWalletCardProps) {
  const [expanded, setExpanded] = useState(false);
  const guide = useMemo(() => buildStudentWalletGuide(), []);

  return (
    <View style={styles.card}>
      <Pressable onPress={() => setExpanded((v) => !v)} style={styles.header}>
        <View>
          <Text style={styles.title}>RDM Wallet</Text>
          <Text style={styles.balance}>{balance} RDM</Text>
        </View>
        <Text style={styles.chevron}>{expanded ? "▲" : "▼"}</Text>
      </Pressable>

      {expanded ? (
        <View style={styles.body}>
          <Text style={styles.section}>Earn</Text>
          {guide.earn.slice(0, 8).map((row) => (
            <View key={row.label} style={styles.row}>
              <Text style={styles.rowLabel}>{row.label}</Text>
              <Text style={styles.rowValue}>{row.value}</Text>
            </View>
          ))}
          <Text style={styles.more}>+ {guide.earn.length - 8} more ways on web</Text>

          {guide.spend.length > 0 ? (
            <>
              <Text style={[styles.section, { marginTop: spacing.sm }]}>Spend / penalties</Text>
              {guide.spend.map((row) => (
                <View key={row.label} style={styles.row}>
                  <Text style={styles.rowLabel}>{row.label}</Text>
                  <Text style={styles.rowSpend}>{row.value}</Text>
                </View>
              ))}
            </>
          ) : null}

          {guide.notes.map((note) => (
            <Text key={note} style={styles.note}>
              {note}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
  },
  title: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
  },
  balance: {
    color: colors.accent,
    fontSize: 24,
    fontWeight: "800",
    marginTop: 2,
  },
  chevron: {
    color: colors.textMuted,
    fontSize: 14,
  },
  body: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing.md,
    gap: 6,
  },
  section: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  rowLabel: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 12,
  },
  rowValue: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "700",
  },
  rowSpend: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "700",
  },
  more: {
    color: colors.textMuted,
    fontSize: 11,
    fontStyle: "italic",
  },
  note: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: spacing.sm,
  },
});
