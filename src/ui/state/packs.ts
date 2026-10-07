/**
 * The app's PackSource. Bundled packs only in v1 (workplan Stage 2a);
 * Stage 2b swaps in a RemotePackSource here and nothing else changes.
 *
 * The hooks use the async PackSource API even though bundled packs load
 * instantly, so screens already handle a source that has to wait.
 */

import { useEffect, useState } from "react";

import { BundledPackSource, type ContentPack } from "../../content";
import { bundledRegistry } from "../../content/bundled.generated";

export const packSource = new BundledPackSource(bundledRegistry);

/** Every available pack, fully loaded, in browser order. `null` while loading. */
export function usePacks(): ContentPack[] | null {
  const [packs, setPacks] = useState<ContentPack[] | null>(null);
  useEffect(() => {
    let live = true;
    packSource
      .listPacks()
      .then((list) => Promise.all(list.map((s) => packSource.loadPack(s.id))))
      .then((loaded) => live && setPacks(loaded))
      .catch((error: unknown) => console.error(error));
    return () => {
      live = false;
    };
  }, []);
  return packs;
}

/** One pack by id. `null` while loading; `undefined` if it does not exist. */
export function usePack(id: string | undefined): ContentPack | null | undefined {
  const [pack, setPack] = useState<ContentPack | null | undefined>(null);
  useEffect(() => {
    let live = true;
    if (id === undefined) {
      setPack(undefined);
      return;
    }
    packSource
      .loadPack(id)
      .then((p) => live && setPack(p))
      .catch(() => live && setPack(undefined));
    return () => {
      live = false;
    };
  }, [id]);
  return pack;
}
