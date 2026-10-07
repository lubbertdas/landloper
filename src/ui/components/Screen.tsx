import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "../theme";

interface Props {
  children: ReactNode;
  /** Scrollable content (default) or a fixed, full-height layout. */
  scroll?: boolean;
  /** Pinned to the bottom, outside the scroll area (e.g. a primary button). */
  footer?: ReactNode;
}

/** Page wrapper: background, padding, safe-area bottom inset. */
export function Screen({ children, scroll = true, footer }: Props) {
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, theme.spacing.md);

  return (
    <View style={styles.root}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.content, !footer && { paddingBottom: bottom }]}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, styles.fill]}>{children}</View>
      )}
      {footer && <View style={[styles.footer, { paddingBottom: bottom }]}>{footer}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
  fill: {
    flex: 1,
  },
  footer: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    gap: theme.spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.track,
    backgroundColor: theme.colors.background,
  },
});
