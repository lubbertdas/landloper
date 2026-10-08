// Settings (workplan Stage 6.6): display units and notification preference,
// plus the diagnostics log (ADR 0012) and, in development builds only, the
// distance source. Preferences are in memory until Stage 7.

import { Stack, router } from "expo-router";
import { StyleSheet, Switch, View } from "react-native";

import { Card, Chip, Screen, Text } from "../src/ui/components";
import { updateSettings, useSettings } from "../src/ui/state/settings";
import { theme } from "../src/ui/theme";

export default function Settings() {
  const { units, notificationsEnabled, devDistanceSource } = useSettings();

  return (
    <Screen>
      <Stack.Screen options={{ title: "Settings" }} />

      <Card>
        <Text variant="title">Distance units</Text>
        <View style={styles.chips}>
          <Chip label="Kilometres" selected={units === "km"} onPress={() => updateSettings({ units: "km" })} />
          <Chip label="Miles" selected={units === "mi"} onPress={() => updateSettings({ units: "mi" })} />
        </View>
      </Card>

      <Card>
        <View style={styles.row}>
          <View style={styles.grow}>
            <Text variant="title">Milestone notifications</Text>
            <Text variant="caption">Notify me as I pass each stop.</Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={(value) => updateSettings({ notificationsEnabled: value })}
            trackColor={{ true: theme.colors.accent, false: theme.colors.track }}
            thumbColor={theme.colors.text}
            accessibilityLabel="Milestone notifications"
          />
        </View>
      </Card>

      {__DEV__ && (
        <Card>
          <Text variant="title">Distance source (development only)</Text>
          <Text variant="caption">Used by the next journey you start.</Text>
          <View style={styles.chips}>
            <Chip
              label="Simulated"
              selected={devDistanceSource === "mock"}
              onPress={() => updateSettings({ devDistanceSource: "mock" })}
            />
            <Chip
              label="GPS"
              selected={devDistanceSource === "gps"}
              onPress={() => updateSettings({ devDistanceSource: "gps" })}
            />
          </View>
        </Card>
      )}

      <Card onPress={() => router.push("/diagnostics")}>
        <Text variant="title">Diagnostics</Text>
        <Text variant="caption">What GPS and notifications did during your walks. Tap to open.</Text>
      </Card>

      <Text variant="caption">Settings reset when the app restarts, until saving arrives.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
  },
  grow: {
    flex: 1,
  },
});
