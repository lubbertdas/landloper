import * as Notifications from "expo-notifications";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

import { milestoneFromResponse } from "../src/runtime/notifications";
import { theme } from "../src/ui/theme";

/** A tapped milestone notification opens that milestone (workplan Stage 5). */
function useNotificationDeepLinks() {
  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    const target = milestoneFromResponse(response);
    if (target === null) return;
    Notifications.clearLastNotificationResponse();
    router.push({ pathname: "/milestone/[packId]/[milestoneId]", params: target });
  }, [response]);
}

export default function RootLayout() {
  useNotificationDeepLinks();
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.background },
          headerTintColor: theme.colors.text,
          headerTitleStyle: { fontWeight: theme.weight.bold },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      />
    </>
  );
}
