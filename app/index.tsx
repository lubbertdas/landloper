import { Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { theme } from "../src/ui/theme";

export default function Home() {
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "Landloper" }} />
      <Text style={styles.title}>Landloper</Text>
      <Text style={styles.body}>Development build is running.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background,
  },
  title: {
    color: theme.colors.accent,
    fontSize: theme.font.display,
    fontWeight: theme.weight.bold,
  },
  body: {
    marginTop: theme.spacing.sm,
    color: theme.colors.textMuted,
    fontSize: theme.font.body,
  },
});
