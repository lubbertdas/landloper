import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { theme } from "../theme";

interface Props {
  children: ReactNode;
  onPress?: () => void;
  /** Removes inner padding, e.g. for an edge-to-edge image on top. */
  flush?: boolean;
}

export function Card({ children, onPress, flush = false }: Props) {
  const style = [styles.card, !flush && styles.padded];
  if (onPress === undefined) return <View style={style}>{children}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [...style, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    overflow: "hidden",
    gap: theme.spacing.sm,
  },
  padded: {
    padding: theme.spacing.md,
  },
  pressed: {
    opacity: 0.8,
  },
});
