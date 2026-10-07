import { StyleSheet, View } from "react-native";

import type { Milestone } from "../../content";
import { theme } from "../theme";

interface Props {
  /** 0.0–1.0 */
  progress: number;
  milestones: readonly Pick<Milestone, "id" | "position">[];
  reachedIds: readonly string[];
}

/**
 * The journey as a line, with a dot per milestone at its true position.
 * Dots cluster where the content clusters — that is intended (ADR 0004).
 */
export function ProgressTrack({ progress, milestones, reachedIds }: Props) {
  const reached = new Set(reachedIds);
  const pct = `${Math.min(1, Math.max(0, progress)) * 100}%` as const;

  return (
    <View
      style={styles.wrap}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
    >
      <View style={styles.track}>
        <View style={[styles.fill, { width: pct }]} />
      </View>
      {milestones.map((m) => (
        <View
          key={m.id}
          style={[
            styles.dot,
            { left: `${m.position * 100}%` },
            reached.has(m.id) ? styles.dotReached : styles.dotUnreached,
          ]}
        />
      ))}
    </View>
  );
}

const DOT = 14;

const styles = StyleSheet.create({
  wrap: {
    height: DOT + 6,
    justifyContent: "center",
    marginHorizontal: DOT / 2,
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.track,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    backgroundColor: theme.colors.reached,
  },
  dot: {
    position: "absolute",
    width: DOT,
    height: DOT,
    marginLeft: -DOT / 2,
    borderRadius: DOT / 2,
    borderWidth: 2,
    borderColor: theme.colors.background,
  },
  dotReached: {
    backgroundColor: theme.colors.reached,
  },
  dotUnreached: {
    backgroundColor: theme.colors.unreached,
  },
});
