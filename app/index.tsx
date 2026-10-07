// Pack browser (workplan Stage 6.1): available packs with covers and
// descriptions, plus a way back into a journey in progress.

import { Link, Stack, router } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { Card, PackTile, ProgressTrack, Screen, Text } from "../src/ui/components";
import { formatDistance } from "../src/ui/format";
import { useJourney } from "../src/ui/state/journey";
import { usePacks } from "../src/ui/state/packs";
import { useSettings } from "../src/ui/state/settings";
import { theme } from "../src/ui/theme";

function HeaderLinks() {
  return (
    <View style={styles.headerLinks}>
      <Link href="/history" asChild>
        <Pressable hitSlop={8}>
          <Text variant="muted">History</Text>
        </Pressable>
      </Link>
      <Link href="/settings" asChild>
        <Pressable hitSlop={8}>
          <Text variant="muted">Settings</Text>
        </Pressable>
      </Link>
    </View>
  );
}

export default function PackBrowser() {
  const packs = usePacks();
  const { current } = useJourney();
  const { units } = useSettings();
  const inProgress =
    current !== null && (current.state.status === "active" || current.state.status === "paused");

  return (
    <Screen>
      <Stack.Screen options={{ title: "Landloper", headerRight: () => <HeaderLinks /> }} />

      {inProgress && (
        <Card onPress={() => router.push("/journey")}>
          <Text variant="caption">
            {current.state.status === "paused" ? "PAUSED JOURNEY" : "JOURNEY IN PROGRESS"}
          </Text>
          <Text variant="title">{current.pack.title}</Text>
          <ProgressTrack
            progress={current.state.cumulativeDistanceM / current.state.totalDistanceM}
            milestones={current.pack.milestones}
            reachedIds={current.state.reachedMilestoneIds}
          />
          <Text variant="muted">
            {formatDistance(current.state.cumulativeDistanceM, units)} of{" "}
            {formatDistance(current.state.totalDistanceM, units)} · tap to continue
          </Text>
        </Card>
      )}

      <Text variant="heading">Choose a journey</Text>
      {packs === null ? (
        <ActivityIndicator color={theme.colors.accent} />
      ) : (
        packs.map((pack) => (
          <PackTile
            key={pack.id}
            pack={pack}
            onPress={() => router.push({ pathname: "/pack/[packId]", params: { packId: pack.id } })}
          />
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerLinks: {
    flexDirection: "row",
    gap: theme.spacing.md,
  },
});
