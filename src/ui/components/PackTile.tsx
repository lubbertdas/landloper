import { StyleSheet, View } from "react-native";

import type { ContentPack } from "../../content";
import { theme } from "../theme";
import { Card } from "./Card";
import { MediaImage } from "./MediaImage";
import { Text } from "./Text";

interface Props {
  pack: ContentPack;
  onPress: () => void;
}

/** A pack in the browser: cover image, title, description, stop count. */
export function PackTile({ pack, onPress }: Props) {
  const cover = pack.media.find((a) => a.ref === pack.coverImage);
  return (
    <Card flush onPress={onPress}>
      {cover && <MediaImage packId={pack.id} asset={cover} />}
      <View style={styles.text}>
        <Text variant="title">{pack.title}</Text>
        <Text variant="muted">{pack.description}</Text>
        <Text variant="caption">{pack.milestones.length} stops</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  text: {
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
});
