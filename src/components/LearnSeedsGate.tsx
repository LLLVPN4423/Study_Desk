"use client";

import { Suspense, use, useMemo, type ReactNode } from "react";
import {
  bootstrapLearn,
  type LearnBootstrapMode,
} from "@/lib/learn-bootstrap";
import type { TrackId } from "@/lib/learn-store-core";

type Props = {
  children: ReactNode;
  mode?: LearnBootstrapMode;
  track?: TrackId;
};

/** Module-level promises so Suspense can wait without dropping the route segment. */
const bootCache = new Map<string, Promise<void>>();

function bootKey(mode: LearnBootstrapMode, track?: TrackId) {
  return `${mode}:${track || ""}`;
}

function ensureBoot(mode: LearnBootstrapMode, track?: TrackId): Promise<void> {
  const key = bootKey(mode, track);
  let p = bootCache.get(key);
  if (!p) {
    p = bootstrapLearn(mode, track ? { track } : undefined);
    bootCache.set(key, p);
  }
  return p;
}

function LearnSeedsReady({ children, mode, track }: Props) {
  const promise = useMemo(
    () => ensureBoot(mode || "path", track),
    [mode, track],
  );
  use(promise);
  return <>{children}</>;
}

/**
 * Prefetch band seeds + gloss before Learn UI runs.
 * Always keeps `{children}` in the tree (Suspense fallback) so Instant
 * Navigation can validate the /learn segment.
 */
export function LearnSeedsGate({ children, mode = "path", track }: Props) {
  return (
    <Suspense
      fallback={
        <div className="page">
          <h1>Loading…</h1>
          <p className="muted">Đang tải từ vựng / nghĩa…</p>
        </div>
      }
    >
      <LearnSeedsReady mode={mode} track={track}>
        {children}
      </LearnSeedsReady>
    </Suspense>
  );
}
