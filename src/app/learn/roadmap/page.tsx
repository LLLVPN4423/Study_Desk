"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { RequireAuth } from "@/components/RequireAuth";
import { getTrack, loadLearn, roadmapFor, type TrackId } from "@/lib/learn-store";

export default function RoadmapPage() {
  return (
    <RequireAuth>
      {(user) => (
        <AppShell userName={user.name}>
          <Suspense fallback={<div className="page"><h1>Loading…</h1></div>}>
            <RoadmapContent />
          </Suspense>
        </AppShell>
      )}
    </RequireAuth>
  );
}

function RoadmapContent() {
  const params = useSearchParams();
  const track = (params.get("track") === "en" ? "en" : "jp") as TrackId;
  const [band, setBand] = useState<string | null>(null);

  useEffect(() => {
    setBand(getTrack(loadLearn(), track).band);
  }, [track]);

  if (!band) {
    return (
      <div className="page narrow">
        <Link href="/learn" className="back">
          ← Back to learn
        </Link>
        <p className="eyebrow">Roadmap · {track.toUpperCase()}</p>
        <h1>Complete placement first</h1>
        <p style={{ color: "var(--muted)", margin: "12px 0 24px" }}>
          Template weeks unlock after an unofficial placement.
        </p>
        <Link href={`/learn/placement?track=${track}`}>
          <Button>Take placement</Button>
        </Link>
      </div>
    );
  }

  const weeks = roadmapFor(track, band);

  return (
    <div className="page narrow">
      <Link href="/learn" className="back">
        ← Back to learn
      </Link>
      <p className="eyebrow">
        {track === "jp" ? "Japanese" : "English"} · Approx. {band}
      </p>
      <h1>Your roadmap</h1>
      <p style={{ color: "var(--muted)", marginTop: 8 }}>
        Template weeks — not AI-generated. Unofficial practice path.
      </p>
      <div className="roadmap-list">
        {weeks.map((w) => (
          <article key={w.week} className="roadmap-week">
            <h3>
              Week {w.week} · {w.title}
            </h3>
            <p>{w.focus}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
