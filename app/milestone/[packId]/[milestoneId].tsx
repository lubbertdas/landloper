// Milestone detail (workplan Stage 6.4): title, body, images, attribution.
// Reachable from the live journey, history, and (Stage 5) a notification tap.

import { Stack, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { Card, MediaImage, Screen, Text } from "../../../src/ui/components";
import { usePack } from "../../../src/ui/state/packs";
import { theme } from "../../../src/ui/theme";

export default function MilestoneDetail() {
  const { packId, milestoneId } = useLocalSearchParams<{ packId: string; milestoneId: string }>();
  const pack = usePack(packId);

  if (pack === null) return <ActivityIndicator style={styles.loading} color={theme.colors.accent} />;
  const milestone = pack?.milestones.find((m) => m.id === milestoneId);
  if (pack === undefined || milestone === undefined) {
    return (
      <Screen>
        <Text variant="muted">This stop is not available.</Text>
      </Screen>
    );
  }

  const assets = milestone.mediaRefs
    .map((ref) => pack.media.find((a) => a.ref === ref))
    .filter((a) => a !== undefined);

  return (
    <Screen>
      <Stack.Screen options={{ title: milestone.title }} />
      {assets.map((asset) => (
        <Card key={asset.ref} flush>
          <MediaImage packId={pack.id} asset={asset} />
          {(asset.caption !== undefined || asset.attribution !== undefined) && (
            <View style={styles.caption}>
              {asset.caption !== undefined && <Text variant="caption">{asset.caption}</Text>}
              {asset.attribution !== undefined && (
                <Text variant="caption">Credit: {asset.attribution}</Text>
              )}
            </View>
          )}
        </Card>
      ))}
      <Text variant="heading">{milestone.title}</Text>
      <Text variant="body">{milestone.body}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  caption: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    gap: theme.spacing.xs,
  },
});
