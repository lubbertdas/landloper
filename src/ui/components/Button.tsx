import { Pressable, StyleSheet, Text } from "react-native";

import { theme } from "../theme";

interface Props {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
}

export function Button({ label, onPress, variant = "primary", disabled = false }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        (pressed || disabled) && styles.dimmed,
      ]}
    >
      <Text style={[styles.label, variant === "primary" ? styles.primaryLabel : styles.otherLabel]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.round,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: {
    backgroundColor: theme.colors.accent,
  },
  secondary: {
    backgroundColor: theme.colors.surfaceRaised,
  },
  danger: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: theme.colors.danger,
  },
  dimmed: {
    opacity: 0.6,
  },
  label: {
    fontSize: theme.font.body,
    fontWeight: theme.weight.bold,
  },
  primaryLabel: {
    color: theme.colors.accentText,
  },
  otherLabel: {
    color: theme.colors.text,
  },
});
