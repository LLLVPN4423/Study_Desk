"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { RequireAuth } from "@/components/RequireAuth";
import { FREE_LIMITS } from "@/lib/freemium";
import {
  canLookup,
  loadLearn,
  recordLookup,
  searchVocab,
  type TrackId,
  type VocabSeed,
} from "@/lib/learn-store";

export default function DictionaryPage() {
  return (
    <RequireAuth>
      {(user) => (
        <AppShell userName={user.name}>
          <Suspense fallback={<div className="page"><h1>Loading…</h1></div>}>
            <DictionaryContent />
          </Suspense>
        </AppShell>
      )}
    </RequireAuth>
  );
}

function DictionaryContent() {
  const params = useSearchParams();
  const track = (params.get("track") === "en" ? "en" : "jp") as TrackId;
  const [q, setQ] = useState("");
  const [results, setResults] = useState<VocabSeed[]>([]);
  const [used, setUsed] = useState(() => loadLearn().lookupsToday);
  const [error, setError] = useState<string | null>(null);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!canLookup()) {
      setError(`Daily Free lookup cap reached (${FREE_LIMITS.dailyLookups}).`);
      return;
    }
    const state = recordLookup();
    setUsed(state.lookupsToday);
    setResults(searchVocab(q, track));
  }

  return (
    <div className="page narrow">
      <Link href="/learn" className="back">
        ← Back to learn
      </Link>
      <p className="eyebrow">Dictionary · {track.toUpperCase()}</p>
      <h1>{track === "jp" ? "OpenJLPT lookup" : "CEFR-J lookup"}</h1>
      <p style={{ color: "var(--muted)", marginTop: 8 }}>
        Local seed search · Free cap {used}/{FREE_LIMITS.dailyLookups} today
      </p>
      <form className="dict-panel" onSubmit={onSearch}>
        <label>
          Search
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={
              track === "jp" ? "kanji, kana, romaji, or English" : "English headword"
            }
          />
        </label>
        <Button type="submit">Search</Button>
      </form>
      {error && <p style={{ color: "var(--danger)", marginTop: 12 }}>{error}</p>}
      <div className="dict-results">
        {results.map((w) => (
          <div key={w.id} className="dict-row">
            <strong>
              {w.word}
              {w.reading ? ` · ${w.reading}` : ""}
            </strong>
            <small>
              {w.meanings.join("; ")} · {w.level}
            </small>
          </div>
        ))}
      </div>
      <p style={{ marginTop: 24, fontSize: 11, color: "var(--muted)" }}>
        See ATTRIBUTION.md for OpenJLPT / CEFR-J credits.
      </p>
    </div>
  );
}
