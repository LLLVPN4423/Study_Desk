"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { RequireAuth } from "@/components/RequireAuth";
import { FREE_LIMITS } from "@/lib/freemium";
import { displayMeanings } from "@/lib/gloss-vi";
import { useI18n } from "@/lib/i18n";
import { bootstrapLearn } from "@/lib/learn-bootstrap";
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
          <Suspense
            fallback={
              <div className="page">
                <h1>Đang tải…</h1>
              </div>
            }
          >
            <DictionaryContent />
          </Suspense>
        </AppShell>
      )}
    </RequireAuth>
  );
}

function DictionaryContent() {
  const { t } = useI18n();
  const params = useSearchParams();
  const track = (params.get("track") === "en" ? "en" : "jp") as TrackId;
  const [q, setQ] = useState("");
  const [results, setResults] = useState<VocabSeed[]>([]);
  const [used, setUsed] = useState(() => loadLearn().lookupsToday);
  const [error, setError] = useState<string | null>(null);
  const [catalogReady, setCatalogReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    bootstrapLearn("catalog", { track }).then(() => {
      if (!cancelled) setCatalogReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [track]);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!catalogReady) {
      setError("Đang tải từ điển… thử lại sau giây lát.");
      return;
    }
    if (!canLookup()) {
      setError(`Đã hết hạn mức tra cứu ngày (${FREE_LIMITS.dailyLookups}).`);
      return;
    }
    const hits = searchVocab(q, track);
    const state = recordLookup(track, q, hits.length);
    setUsed(state.lookupsToday);
    setResults(hits);
    if (!hits.length) {
      setError("Không có kết quả — chỉ tra cứu ra từ mới tính vào lộ trình.");
    }
  }

  return (
    <div className="page narrow">
      <Link href={`/learn?track=${track}`} className="back">
        {t("dictBack")}
      </Link>
      <p className="eyebrow">
        {t("dictTitle")} · {track.toUpperCase()}
      </p>
      <h1>{track === "jp" ? "OpenJLPT" : "CEFR-J"}</h1>
      <p style={{ color: "var(--muted)", marginTop: 8 }}>
        {t("dictLocal")} · {used} {t("dictLookupsToday")}
      </p>
      <form className="dict-panel" onSubmit={onSearch}>
        <label>
          {t("dictSearch")}
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={
              track === "jp" ? t("dictPlaceholderJp") : t("dictPlaceholderEn")
            }
          />
        </label>
        <Button type="submit">{t("dictSearch")}</Button>
      </form>
      {error && <p style={{ color: "var(--danger)", marginTop: 12 }}>{error}</p>}
      <div className="dict-results">
        {results.map((w) => {
          const meanings = displayMeanings(track, w.id, w.meanings || [], {
            word: w.word,
            pos: w.pos,
          });
          return (
            <div key={w.id} className="dict-row">
              <strong>
                {w.word}
                {w.reading ? ` · ${w.reading}` : ""}
              </strong>
              <small>
                {meanings.join("; ")} · {w.level}
              </small>
            </div>
          );
        })}
      </div>
      <p style={{ marginTop: 24, fontSize: 11, color: "var(--muted)" }}>
        Xem ATTRIBUTION.md cho OpenJLPT / CEFR-J.
      </p>
    </div>
  );
}
