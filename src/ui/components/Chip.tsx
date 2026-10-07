import { Pressable, StyleSheet, Text } from "react-native";

import { theme } from "../theme";

interface Props {
  label: string;
  selected: boolean;
  onPress: () => void;
}

/** A selectable pill: distances, units, simulation speed. */
export function Chip({ label, selected, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.selected]}
    >
      <Text style={[styles.label, selected && styles.selectedLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 44,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.round,
    borderWidth: 1,
    borderColor: theme.colors.unreached,
    alignItems: "center",
    justifyContent: "center",
  },
  selected: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  label: {
    color: theme.colors.text,
    fontSize: theme.font.body,
    fontWeight: theme.weight.bold,
  },
  selectedLabel: {
    color: theme.colors.accentText,
  },
});
