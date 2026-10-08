// Diagnostics (ADR 0012): what GPS, the journey and notifications did, so a
// failed field test shows where it went wrong. Kept in the on-device
// database; "Share log" sends it as text (e-mail, Drive, a chat to yourself).

import { Stack } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Share, StyleSheet, View } from "react-native";

import type { DiagnosticEntry } from "../src/platform";
import { diagnostics } from "../src/runtime/services";
import { Button, Card, Screen, Text } from "../src/ui/components";
import { theme } from "../src/ui/theme";

const SHOWN = 300;
const SHARED = 3000;

function time(iso: string): string {
  return iso.slice(11, 19);
}

function line(e: DiagnosticEntry): string {
  return `${e.at} ${e.kind.padEnd(12)} ${e.message}`;
}

/** Counts of each GPS fix outcome, from the "fix" entries' first word. */
function fixSummary(entries: DiagnosticEntry[]): string {
  const counts = new Map<string, number>();
  for (const e of entries) {
    if (e.kind !== "fix") continue;
    const outcome = e.message.split(" ")[0] ?? "?";
    counts.set(outcome, (counts.get(outcome) ?? 0) + 1);
  }
  if (counts.size === 0) return "No GPS fixes logged yet.";
  return [...counts].map(([k, n]) => `${k} ${n}`).join(" · ");
}

export default function Diagnostics() {
  const [entries, setEntries] = useState<DiagnosticEntry[]>([]);
  const refresh = useCallback(() => setEntries(diagnostics.recent(SHARED)), []);

  useEffect(() => {
    refresh();
    const handle = setInterval(refresh, 2000);
    return () => clearInterval(handle);
  }, [refresh]);

  const errors = entries.filter((e) => e.kind === "error").length;

  return (
    <Screen
      footer={
        <View style={styles.buttons}>
          <View style={styles.grow}>
            <Button
              label="Share log"
              onPress={() =>
                Share.share({ message: [...entries].reverse().map(line).join("\n") })
              }
            />
          </View>
          <View style={styles.grow}>
            <Button
              label="Clear"
              variant="secondary"
              onPress={() => {
                diagnostics.clear();
                refresh();
              }}
            />
          </View>
        </View>
      }
    >
      <Stack.Screen options={{ title: "Diagnostics" }} />

      <Card>
        <Text variant="title">GPS fixes</Text>
        <Text variant="muted">{fixSummary(entries)}</Text>
        <Text variant="caption">
          {entries.length} entries{errors > 0 ? ` · ${errors} errors` : ""} · newest first
        </Text>
      </Card>

      {entries.slice(0, SHOWN).map((e) => (
        <View key={e.id} style={styles.entry}>
          <Text variant="caption">
            {time(e.at)} · {e.kind}
          </Text>
          <Text variant={e.kind === "error" ? "body" : "muted"}>{e.message}</Text>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  buttons: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  grow: {
    flex: 1,
  },
  entry: {
    gap: theme.spacing.xs,
  },
});
