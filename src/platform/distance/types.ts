/**
 * The distance seam (workplan Stage 4). Everything above this interface —
 * engine adapter, UI — is identical whether distance comes from the mock,
 * from GPS, or (post-v1) from a pedometer.
 */

/** Receives cumulative metres since journey start. Monotonic. */
export type DistanceListener = (cumulativeMetres: number) => void;

export interface DistanceProvider {
  /** Begin measuring from 0 m. */
  start(): void;
  /** Stop measuring for good. Further calls to other methods are no-ops. */
  stop(): void;
  /** Stop accumulating until `resume`; distance walked meanwhile is not counted. */
  pause(): void;
  resume(): void;
  /** Subscribe to distance updates. Returns an unsubscribe function. */
  onDistance(listener: DistanceListener): () => void;
}
