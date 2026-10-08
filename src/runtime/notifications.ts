/**
 * expo-notifications behind the platform's `Notifier` seam (Stage 5).
 */

import * as Notifications from "expo-notifications";

import type { MilestoneNotification, Notifier } from "../platform";

const CHANNEL_ID = "milestones";

let channelReady: Promise<unknown> | null = null;

/** Android needs the channel to exist before the first notification. */
function ensureChannel(): Promise<unknown> {
  channelReady ??= Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: "Milestones",
    description: "A notification as you pass each stop on your journey.",
    importance: Notifications.AndroidImportance.HIGH,
  });
  return channelReady;
}

/** Show milestone notifications even while the app is open. */
export function configureNotificationHandling(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export class ExpoNotifier implements Notifier {
  async present(n: MilestoneNotification): Promise<void> {
    await ensureChannel();
    await Notifications.scheduleNotificationAsync({
      content: { title: n.title, body: n.body, data: n.data },
      // A trigger with only a channel means "now", on that channel.
      trigger: { channelId: CHANNEL_ID },
    });
  }
}

/** Android 13+ asks; older versions grant at install. */
export async function requestNotificationPermission(): Promise<boolean> {
  await ensureChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

/** The milestone a notification response points at, if it is one of ours. */
export function milestoneFromResponse(
  response: Notifications.NotificationResponse | null | undefined,
): { packId: string; milestoneId: string } | null {
  const data = response?.notification.request.content.data as
    | { packId?: unknown; milestoneId?: unknown }
    | undefined;
  if (typeof data?.packId === "string" && typeof data.milestoneId === "string") {
    return { packId: data.packId, milestoneId: data.milestoneId };
  }
  return null;
}
