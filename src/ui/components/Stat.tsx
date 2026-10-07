import { StyleSheet, View } from "react-native";

import { theme } from "../theme";
import { Text } from "./Text";

interface Props {
  label: string;
  value: string;
  align?: "left" | "right";
}

/** A labelled number, sized to be read at a glance while walking. */
export function Stat({ label, value, align = "left" }: Props) {
  return (
    <View style={[styles.stat, align === "right" && styles.right]}>
      <Text variant="caption">{label}</Text>
      <Text variant="heading">{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stat: {
    gap: theme.spacing.xs,
  },
  right: {
    alignItems: "flex-end",
  },
});
