// Live journey (workplan Stage 6.3): progress along the path, distance
// walked and remaining, next milestone and distance to it, and the current
// milestone's media on passing one. Glanceable — people are walking.

import { Stack, router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import {
  Button,
  Card,
  Chip,
  GpsStatusLine,
  MediaImage,
  MilestoneRow,
  ProgressTrack,
  Screen,
  Stat,
  Text,
} from "../src/ui/components";
import { formatDistance, formatDuration } from "../src/ui/format";
import {
  getSimulationSpeed,
  journeyController,
  setSimulationSpeed,
  useGpsStatus,
  useJourney,
} from "../src/ui/state/journey";
import { useSettings } from "../src/ui/state/settings";
import { theme } from "../src/ui/theme";

const SPEEDS = [1, 10, 50, 200];

function openMilestone(packId: string, milestoneId: string) {
  router.push({ pathname: "/milestone/[packId]/[milestoneId]", params: { packId, milestoneId } });
}

export default function LiveJourney() {
  const { current } = useJourney();
  const { units } = useSettings();
  const [speed, setSpeed] = useState(getSimulationSpeed());
  const gps = useGpsStatus();

  if (current === null) {
    return (
      <Screen>
        <Stack.Screen options={{ title: "Journey" }} />
        <Text variant="muted">No journey in progress.</Text>
        <Button label="Choose a journey" onPress={() => router.replace("/")} />
      </Screen>
    );
  }

  const { pack, state } = current;
  const reached = new Set(state.reachedMilestoneIds);
  const next = pack.milestones.find((m) => !reached.has(m.id));
  const latest = pack.milestones.find((m) => m.id === current.latestMilestoneId);
  const latestAsset = pack.media.find((a) => a.ref === latest?.mediaRefs[0]);
  const progress = state.cumulativeDistanceM / state.totalDistanceM;
  const done = state.status === "completed";

  function finish() {
    journeyController.end();
    router.replace("/");
  }

  const footer = done ? (
    <>
      <Button label="Done" onPress={finish} />
      <Button label="See history" variant="secondary" onPress={() => router.replace("/history")} />
    </>
  ) : (
    <View style={styles.controls}>
      <View style={styles.grow}>
        {state.status === "paused" ? (
          <Button label="Resume" onPress={() => journeyController.resume()} />
        ) : (
          <Button label="Pause" variant="secondary" onPress={() => journeyController.pause()} />
        )}
      </View>
      <View style={styles.grow}>
        <Button
          label="End"
          variant="danger"
          onPress={() => {
            journeyController.end();
            router.replace("/");
          }}
        />
      </View>
    </View>
  );

  return (
    <Screen footer={footer}>
      <Stack.Screen options={{ title: pack.title }} />

      <View style={styles.stats}>
        <Stat label="WALKED" value={formatDistance(state.cumulativeDistanceM, units)} />
        <Stat
          label="REMAINING"
          value={formatDistance(state.totalDistanceM - state.cumulativeDistanceM, units)}
          align="right"
        />
      </View>
      <ProgressTrack
        progress={progress}
        milestones={pack.milestones}
        reachedIds={state.reachedMilestoneIds}
      />
      <Text variant="caption" align="center">
        {state.status === "paused"
          ? "Paused — distance is not counted"
          : done
            ? "Journey complete"
            : `${Math.floor(progress * 100)}% of ${formatDistance(state.totalDistanceM, units)}`}
      </Text>
      {!done && current.source === "gps" && (
        <GpsStatusLine status={gps} paused={state.status === "paused"} />
      )}

      {done && state.endedAt !== undefined && (
        <Card>
          <Text variant="accent">You made it.</Text>
          <Text variant="body">
            {pack.milestones.length} stops, {formatDistance(state.totalDistanceM, units)} in{" "}
            {formatDuration(state.startedAt, state.endedAt)}.
          </Text>
        </Card>
      )}

      {next !== undefined && (
        <>
          <Text variant="caption">NEXT STOP</Text>
          <MilestoneRow
            pack={pack}
            milestone={next}
            detail={`in ${formatDistance(next.position * state.totalDistanceM - state.cumulativeDistanceM, units)}`}
            onPress={() => openMilestone(pack.id, next.id)}
          />
        </>
      )}

      {latest !== undefined && (
        <>
          <Text variant="caption">{done ? "LAST STOP" : "YOU'VE REACHED"}</Text>
          <Card flush onPress={() => openMilestone(pack.id, latest.id)}>
            {latestAsset && <MediaImage packId={pack.id} asset={latestAsset} />}
            <View style={styles.cardText}>
              <Text variant="accent">{latest.title}</Text>
              <Text variant="body" numberOfLines={3}>
                {latest.body}
              </Text>
              <Text variant="caption">Tap to read more</Text>
            </View>
          </Card>
        </>
      )}

      {!done && current.source === "mock" && (
        <View style={styles.dev}>
          <Text variant="caption">SIMULATED WALKING SPEED (DEVELOPMENT ONLY)</Text>
          <View style={styles.chips}>
            {SPEEDS.map((s) => (
              <Chip
                key={s}
                label={`${s}×`}
                selected={speed === s}
                onPress={() => {
                  setSimulationSpeed(s);
                  setSpeed(s);
                }}
              />
            ))}
          </View>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stats: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  controls: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  grow: {
    flex: 1,
  },
  cardText: {
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  dev: {
    marginTop: theme.spacing.lg,
    gap: theme.spacing.sm,
    opacity: 0.8,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
});
