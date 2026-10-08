/**
 * Milestone crossings → local notifications (workplan Stage 5).
 *
 * Which events notify, and with what text, is decided here in plain
 * TypeScript. Presenting them is the `Notifier`'s job (expo-notifications
 * in the app, a fake in tests).
 */

import type { ContentPack } from "../../content";
import type { JourneyEvent } from "../../engine";
import type { JourneyController } from "../journey/JourneyController";
import type { DiagnosticsLog } from "../storage/types";

export interface MilestoneNotification {
  title: string;
  body: string;
  /** Read back on tap to deep-link to the milestone detail screen. */
  data: { packId: string; milestoneId: string };
}

export interface Notifier {
  present(notification: MilestoneNotification): Promise<void>;
}

/**
 * One notification per milestone reached on the way, using the pack's
 * authored notification text. Milestones reached at the start are
 * suppressed: the live screen shows those as its opening card.
 */
export function milestoneNotifications(
  events: readonly JourneyEvent[],
  pack: ContentPack,
): MilestoneNotification[] {
  const out: MilestoneNotification[] = [];
  for (const e of events) {
    if (e.type !== "MilestoneReached" || e.atStart) continue;
    const milestone = pack.milestones.find((m) => m.id === e.milestoneId);
    if (milestone === undefined) continue;
    out.push({
      title: milestone.notification.title,
      body: milestone.notification.body,
      data: { packId: pack.id, milestoneId: milestone.id },
    });
  }
  return out;
}

/** Sends milestone notifications for every event batch the controller emits. */
export function connectNotifications(
  controller: JourneyController,
  notifier: Notifier,
  options: { isEnabled: () => boolean; log: DiagnosticsLog },
): () => void {
  return controller.onEvents((events, journey) => {
    const notifications = milestoneNotifications(events, journey.pack);
    if (notifications.length === 0) return;
    if (!options.isEnabled()) {
      options.log.log("notification", `Skipped ${notifications.length}: turned off in settings`);
      return;
    }
    for (const n of notifications) {
      notifier.present(n).then(
        () => options.log.log("notification", `Sent: ${n.data.milestoneId}`),
        (error: unknown) =>
          options.log.log("error", `Notification for ${n.data.milestoneId} failed: ${String(error)}`),
      );
    }
  });
}
