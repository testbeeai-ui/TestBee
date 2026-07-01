import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Subject } from "@/core/domain/curriculum";
import { colors } from "@/shared/constants/theme";

const SUBJECTS: { id: Subject; label: string; emoji: string }[] = [
  { id: "physics", label: "Physics", emoji: "⚛️" },
  { id: "chemistry", label: "Chemistry", emoji: "🧪" },
  { id: "math", label: "Math", emoji: "📐" },
];

type SubjectPickerProps = {
  value: Subject;
  onChange: (s: Subject) => void;
};

export function SubjectPicker({ value, onChange }: SubjectPickerProps) {
  return (
    <View style={styles.row}>
      {SUBJECTS.map((s) => (
        <Pressable
          key={s.id}
          onPress={() => onChange(s.id)}
          style={[styles.chip, value === s.id && styles.chipActive]}
        >
          <Text style={styles.emoji}>{s.emoji}</Text>
          <Text style={[styles.label, value === s.id && styles.labelActive]}>{s.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 8,
  },
  chip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: 2,
  },
  chipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  emoji: {
    fontSize: 18,
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  labelActive: {
    color: colors.accent,
  },
});
