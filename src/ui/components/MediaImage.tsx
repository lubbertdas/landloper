import { Image, StyleSheet, View } from "react-native";

import type { MediaAsset } from "../../content";
import { packSource } from "../state/packs";
import { theme } from "../theme";

interface Props {
  packId: string;
  asset: MediaAsset;
  /** Use the thumbnail (lists) instead of the full image (cards, detail). */
  thumbnail?: boolean;
  /** Fixed square size for thumbnails; full images fill their width. */
  size?: number;
}

/**
 * A pack image. Full images keep their authored aspect ratio; the caption
 * doubles as alt text for TalkBack (workplan Stage 8).
 *
 * The frame View owns the size and the Image fills it. A bundled Image
 * sized directly by percentage falls back to the file's intrinsic size on
 * Android, which is why the frame exists.
 */
export function MediaImage({ packId, asset, thumbnail = false, size = 64 }: Props) {
  const ref = thumbnail && asset.thumbnailRef !== undefined ? asset.thumbnailRef : asset.ref;
  return (
    <View
      style={
        thumbnail
          ? [styles.thumb, { width: size, height: size }]
          : [styles.full, { aspectRatio: asset.width / asset.height }]
      }
    >
      <Image
        source={packSource.resolveMedia(packId, ref)}
        accessibilityLabel={asset.caption}
        style={styles.fill}
        resizeMode="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  thumb: {
    borderRadius: theme.radius.sm,
    overflow: "hidden",
  },
  full: {
    width: "100%",
    overflow: "hidden",
  },
  fill: {
    width: "100%",
    height: "100%",
  },
});
