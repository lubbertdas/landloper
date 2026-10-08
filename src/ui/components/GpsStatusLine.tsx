import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import type { GpsStatus } from "../../platform";
import { theme } from "../theme";
import { Text } from "./Text";

interface Props {
  status: GpsStatus;
  paused: boolean;
}

/** A small "is GPS working?" line for the live screen. Updates every second. */
export function GpsStatusLine({ status, paused }: Props) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const handle = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(handle);
  }, []);

  // Silence this long after starting is worth flagging (indoors, or the
  // phone's location service is not delivering).
  const SILENT_WARNING_S = 120;
  const listeningS =
    status.listeningSince === null ? 0 : (now - Date.parse(status.listeningSince)) / 1000;
  const silent = status.lastFixAt === null && listeningS > SILENT_WARNING_S;

  let message: string;
  if (status.lastError !== null) message = "GPS problem — see Settings › Diagnostics";
  else if (paused) message = "GPS off while paused";
  else if (silent) message = "No GPS signal yet — are you outdoors? See Settings › Diagnostics";
  else if (status.lastFixAt === null) message = "Waiting for GPS… (first fix can take a minute)";
  else {
    const seconds = Math.max(0, Math.round((now - Date.parse(status.lastFixAt)) / 1000));
    const accuracy =
      status.lastAccuracyM === null ? "" : ` · ±${Math.round(status.lastAccuracyM)} m`;
    message = `GPS fix ${seconds} s ago${accuracy}`;
  }

  return (
    <View style={styles.row}>
      <View style={[styles.dot, (status.lastError !== null || silent) && styles.dotError]} />
      <Text variant="caption">{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: theme.radius.round,
    backgroundColor: theme.colors.accent,
  },
  dotError: {
    backgroundColor: theme.colors.danger,
  },
});
