/**
 * PackSource — the seam that keeps remote packs (Stage 2b) a drop-in
 * change — and BundledPackSource, which reads packs shipped in the app.
 *
 * Everything above this interface (engine, UI, persistence) is unchanged
 * when a RemotePackSource reads the same folder shape from local storage.
 */

import type { ContentPack, MediaRef, PackSummary } from "./types";

/**
 * Something an <Image> can display. A bundled asset is a Metro module id
 * (number); a downloaded one (Stage 2b) will be a `{ uri }` to a local file.
 */
export type MediaSource = number | { uri: string };

export interface PackSource {
  listPacks(): Promise<PackSummary[]>;
  loadPack(id: string): Promise<ContentPack>;
  /** Throws if the pack or ref is unknown. */
  resolveMedia(packId: string, ref: MediaRef): MediaSource;
}

/** What bundled.generated.ts provides: each pack's JSON and media modules. */
export type BundledRegistry = Record<
  string,
  { pack: unknown; media: Record<MediaRef, MediaSource> }
>;

export class PackNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PackNotFoundError";
  }
}

/**
 * Asserts the derived fields are present. The validator guarantees this for
 * anything in the generated registry; the check turns a tooling mistake into
 * a clear error instead of NaN positions.
 */
function asCompletePack(id: string, raw: unknown): ContentPack {
  const pack = raw as ContentPack;
  for (const m of pack.milestones) {
    if (typeof m.position !== "number") {
      throw new Error(`Pack "${id}" milestone "${m.id}" has no position; run npm run validate.`);
    }
  }
  for (const a of pack.media) {
    if (typeof a.width !== "number" || typeof a.height !== "number") {
      throw new Error(`Pack "${id}" media "${a.ref}" has no dimensions; run npm run media.`);
    }
  }
  return pack;
}

export function summarize(pack: ContentPack): PackSummary {
  return {
    id: pack.id,
    title: pack.title,
    description: pack.description,
    domainType: pack.domainType,
    version: pack.version,
    coverImage: pack.coverImage,
    suggestedDistancesM: pack.suggestedDistancesM,
    milestoneCount: pack.milestones.length,
  };
}

export class BundledPackSource implements PackSource {
  private readonly cache = new Map<string, ContentPack>();

  constructor(private readonly registry: BundledRegistry) {}

  async listPacks(): Promise<PackSummary[]> {
    return Object.keys(this.registry)
      .map((id) => summarize(this.load(id)))
      .sort((a, b) => a.title.localeCompare(b.title));
  }

  async loadPack(id: string): Promise<ContentPack> {
    return this.load(id);
  }

  /** Synchronous load; bundled JSON is already in memory. */
  loadPackSync(id: string): ContentPack {
    return this.load(id);
  }

  resolveMedia(packId: string, ref: MediaRef): MediaSource {
    const entry = this.registry[packId];
    if (entry === undefined) throw new PackNotFoundError(`Unknown pack "${packId}".`);
    const source = entry.media[ref];
    if (source === undefined) {
      throw new PackNotFoundError(`Pack "${packId}" has no bundled media "${ref}".`);
    }
    return source;
  }

  private load(id: string): ContentPack {
    const cached = this.cache.get(id);
    if (cached !== undefined) return cached;
    const entry = this.registry[id];
    if (entry === undefined) throw new PackNotFoundError(`Unknown pack "${id}".`);
    const pack = asCompletePack(id, entry.pack);
    this.cache.set(id, pack);
    return pack;
  }
}
