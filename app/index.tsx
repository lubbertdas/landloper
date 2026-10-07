// Stage 4/2a demo: a mock walk over bundled content. Replaced at Stage 6.

import { Stack } from "expo-router";
import { useEffect } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { journeyController, setSimulationSpeed, useJourney } from "../src/ui/state/journey";
import { packSource } from "../src/ui/state/packs";
import { theme } from "../src/ui/theme";

const pack = packSource.loadPackSync("solar-system");

export default function Home() {
  const { current } = useJourney();

  useEffect(
    () =>
      journeyController.onEvents((events) => {
        for (const e of events) console.log("[journey]", JSON.stringify(e));
      }),
    [],
  );

  const status = current?.state.status;
  const latest = pack.milestones.find((m) => m.id === current?.latestMilestoneId);

  function startWalk() {
    journeyController.end();
    setSimulationSpeed(100);
    journeyController.start(pack, 2000);
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "Landloper" }} />
      <Text style={styles.title}>Mock walk</Text>
      <Text style={styles.body}>
        2 km through the solar system, at 100× walking speed.
      </Text>

      {current && (
        <View style={styles.card}>
          <Text style={styles.big}>
            {Math.round(current.state.cumulativeDistanceM)} m
          </Text>
          <Text style={styles.body}>Status: {status}</Text>
          {latest?.mediaRefs[0] !== undefined && (
            <Image
              source={packSource.resolveMedia(pack.id, latest.mediaRefs[0])}
              style={styles.image}
              resizeMode="contain"
            />
          )}
          <Text style={styles.milestone}>{latest?.title ?? "—"}</Text>
          {latest && <Text style={styles.body}>{latest.notification.body}</Text>}
        </View>
      )}

      <Pressable style={styles.button} onPress={startWalk}>
        <Text style={styles.buttonText}>
          {current ? "Restart mock walk" : "Start mock walk"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    backgroundColor: theme.colors.background,
  },
  title: {
    color: theme.colors.accent,
    fontSize: theme.font.heading,
    fontWeight: theme.weight.bold,
  },
  body: {
    color: theme.colors.textMuted,
    fontSize: theme.font.body,
    textAlign: "center",
  },
  card: {
    alignSelf: "stretch",
    alignItems: "center",
    gap: theme.spacing.sm,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
  },
  big: {
    color: theme.colors.text,
    fontSize: theme.font.display,
    fontWeight: theme.weight.bold,
  },
  image: {
    width: "100%",
    aspectRatio: 4 / 3,
  },
  milestone: {
    color: theme.colors.accent,
    fontSize: theme.font.title,
    fontWeight: theme.weight.bold,
  },
  button: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.radius.round,
    backgroundColor: theme.colors.accent,
  },
  buttonText: {
    color: theme.colors.accentText,
    fontSize: theme.font.body,
    fontWeight: theme.weight.bold,
  },
});
