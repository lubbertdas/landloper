import type { ReactNode } from "react";
import { StyleSheet, Text as RNText, type TextStyle } from "react-native";

import { theme } from "../theme";

type Variant = "display" | "heading" | "title" | "body" | "muted" | "caption" | "accent";

interface Props {
  children: ReactNode;
  variant?: Variant;
  align?: TextStyle["textAlign"];
  numberOfLines?: number;
}

/** Every piece of text in the app goes through one of these variants. */
export function Text({ children, variant = "body", align, numberOfLines }: Props) {
  return (
    <RNText
      style={[styles[variant], align !== undefined && { textAlign: align }]}
      numberOfLines={numberOfLines}
    >
      {children}
    </RNText>
  );
}

const styles = StyleSheet.create({
  display: {
    color: theme.colors.text,
    fontSize: theme.font.display,
    fontWeight: theme.weight.bold,
  },
  heading: {
    color: theme.colors.text,
    fontSize: theme.font.heading,
    fontWeight: theme.weight.bold,
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.font.title,
    fontWeight: theme.weight.bold,
  },
  body: {
    color: theme.colors.text,
    fontSize: theme.font.body,
    lineHeight: theme.font.body * 1.45,
  },
  muted: {
    color: theme.colors.textMuted,
    fontSize: theme.font.body,
    lineHeight: theme.font.body * 1.4,
  },
  caption: {
    color: theme.colors.textMuted,
    fontSize: theme.font.caption,
  },
  accent: {
    color: theme.colors.accent,
    fontSize: theme.font.title,
    fontWeight: theme.weight.bold,
  },
});
