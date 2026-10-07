import { StyleSheet, View } from "react-native";

import type { ContentPack, Milestone } from "../../content";
import { theme } from "../theme";
import { Card } from "./Card";
import { MediaImage } from "./MediaImage";
import { Text } from "./Text";

interface Props {
  pack: ContentPack;
  milestone: Milestone;
  /** Right-hand detail, e.g. "in 320 m" or "reached". */
  detail?: string;
  onPress: () => void;
}

/** A compact milestone line: thumbnail, title, optional detail. */
export function MilestoneRow({ pack, milestone, detail, onPress }: Props) {
  const ref = milestone.mediaRefs[0];
  const asset = pack.media.find((a) => a.ref === ref);
  return (
    <Card onPress={onPress}>
      <View style={styles.row}>
        {asset && <MediaImage packId={pack.id} asset={asset} thumbnail size={48} />}
        <View style={styles.text}>
          <Text variant="title" numberOfLines={1}>
            {milestone.title}
          </Text>
          {detail !== undefined && <Text variant="caption">{detail}</Text>}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
  },
  text: {
    flex: 1,
    gap: theme.spacing.xs,
  },
});
