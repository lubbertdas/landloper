// Setup flow (workplan Stage 6.2): pick a pack → see suggested distances →
// choose the journey distance → start. No scaling-model or distance-source
// choice: both are decided by the app. The permissions step arrives with GPS.

import { Stack, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, StyleSheet, TextInput, View } from "react-native";

import { Button, Card, Chip, MediaImage, Screen, Text } from "../../src/ui/components";
import { formatDistance, formatDistanceShort, parseDistance } from "../../src/ui/format";
import { journeyController, useJourney } from "../../src/ui/state/journey";
import { usePack } from "../../src/ui/state/packs";
import { useSettings } from "../../src/ui/state/settings";
import { theme } from "../../src/ui/theme";

const CUSTOM = -1;

export default function PackSetup() {
  const { packId } = useLocalSearchParams<{ packId: string }>();
  const pack = usePack(packId);
  const { current } = useJourney();
  const { units } = useSettings();
  const [selected, setSelected] = useState<number | null>(null);
  const [custom, setCustom] = useState("");

  if (pack === null) return <ActivityIndicator style={styles.loading} color={theme.colors.accent} />;
  if (pack === undefined) {
    return (
      <Screen>
        <Text variant="muted">This pack is not available.</Text>
      </Screen>
    );
  }

  const choice = selected ?? pack.suggestedDistancesM[0] ?? null;
  const distanceM = choice === CUSTOM ? parseDistance(custom, units) : choice;
  const busy =
    current !== null && (current.state.status === "active" || current.state.status === "paused");
  const cover = pack.media.find((a) => a.ref === pack.coverImage);

  function start() {
    if (distanceM === null || pack == null) return;
    journeyController.start(pack, distanceM);
    router.replace("/journey");
  }

  return (
    <Screen
      footer={
        busy ? (
          <>
            <Text variant="caption" align="center">
              Finish or end your current journey before starting another.
            </Text>
            <Button label="Go to current journey" onPress={() => router.replace("/journey")} />
          </>
        ) : (
          <Button
            label={distanceM === null ? "Choose a distance" : `Start · ${formatDistance(distanceM, units)}`}
            onPress={start}
            disabled={distanceM === null}
          />
        )
      }
    >
      <Stack.Screen options={{ title: pack.title }} />

      {cover && (
        <Card flush>
          <MediaImage packId={pack.id} asset={cover} />
        </Card>
      )}
      <Text variant="body">{pack.description}</Text>
      <Text variant="caption">{pack.milestones.length} stops</Text>

      <Text variant="title">How far will you walk?</Text>
      <Text variant="muted">
        The whole journey is scaled to fit. Every stop is on the way, whatever distance you pick.
      </Text>
      <View style={styles.chips}>
        {pack.suggestedDistancesM.map((m) => (
          <Chip
            key={m}
            label={formatDistanceShort(m, units)}
            selected={choice === m}
            onPress={() => setSelected(m)}
          />
        ))}
        <Chip label="Custom" selected={choice === CUSTOM} onPress={() => setSelected(CUSTOM)} />
      </View>

      {choice === CUSTOM && (
        <View style={styles.customRow}>
          <TextInput
            value={custom}
            onChangeText={setCustom}
            keyboardType="decimal-pad"
            placeholder="e.g. 3.5"
            placeholderTextColor={theme.colors.textMuted}
            style={styles.input}
            autoFocus
            accessibilityLabel={`Custom distance in ${units}`}
          />
          <Text variant="title">{units}</Text>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  customRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  input: {
    flex: 1,
    minHeight: 52,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    fontSize: theme.font.title,
  },
});
