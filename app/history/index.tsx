// History (workplan Stage 6.5): completed journeys, newest first.
// In memory until Stage 7 — cleared when the app restarts.

import { Stack, router } from "expo-router";

import { Card, Screen, Text } from "../../src/ui/components";
import { formatDateTime, formatDistance } from "../../src/ui/format";
import { useJourney } from "../../src/ui/state/journey";
import { useSettings } from "../../src/ui/state/settings";

export default function History() {
  const { history } = useJourney();
  const { units } = useSettings();

  return (
    <Screen>
      <Stack.Screen options={{ title: "History" }} />
      {history.length === 0 ? (
        <>
          <Text variant="muted">No completed journeys yet.</Text>
          <Text variant="caption">
            History is kept until the app is closed, until saving arrives in a later stage.
          </Text>
        </>
      ) : (
        history.map(({ pack, state }) => (
          <Card
            key={state.id}
            onPress={() =>
              router.push({ pathname: "/history/[journeyId]", params: { journeyId: state.id } })
            }
          >
            <Text variant="title">{pack.title}</Text>
            <Text variant="muted">
              {formatDistance(state.totalDistanceM, units)} ·{" "}
              {state.reachedMilestoneIds.length} stops
            </Text>
            <Text variant="caption">{formatDateTime(state.endedAt ?? state.startedAt)}</Text>
          </Card>
        ))
      )}
    </Screen>
  );
}
