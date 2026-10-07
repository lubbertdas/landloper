// History drill-down: the milestones reached on one completed journey.

import { Stack, router, useLocalSearchParams } from "expo-router";

import { MilestoneRow, Screen, Text } from "../../src/ui/components";
import { formatDateTime, formatDistance, formatDuration } from "../../src/ui/format";
import { useJourney } from "../../src/ui/state/journey";
import { useSettings } from "../../src/ui/state/settings";

export default function HistoryEntry() {
  const { journeyId } = useLocalSearchParams<{ journeyId: string }>();
  const { history } = useJourney();
  const { units } = useSettings();
  const entry = history.find((h) => h.state.id === journeyId);

  if (entry === undefined) {
    return (
      <Screen>
        <Text variant="muted">This journey is no longer in history.</Text>
      </Screen>
    );
  }

  const { pack, state } = entry;
  const reached = state.reachedMilestoneIds
    .map((id) => pack.milestones.find((m) => m.id === id))
    .filter((m) => m !== undefined);

  return (
    <Screen>
      <Stack.Screen options={{ title: pack.title }} />
      <Text variant="heading">{formatDistance(state.totalDistanceM, units)}</Text>
      <Text variant="muted">
        {formatDateTime(state.startedAt)}
        {state.endedAt !== undefined && ` · ${formatDuration(state.startedAt, state.endedAt)}`}
      </Text>
      <Text variant="caption">STOPS REACHED</Text>
      {reached.map((m) => (
        <MilestoneRow
          key={m.id}
          pack={pack}
          milestone={m}
          onPress={() =>
            router.push({
              pathname: "/milestone/[packId]/[milestoneId]",
              params: { packId: pack.id, milestoneId: m.id },
            })
          }
        />
      ))}
    </Screen>
  );
}
