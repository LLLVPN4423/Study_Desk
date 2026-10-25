"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { getEnSeed, getJpSeed, type TrackId, type VocabSeed } from "@/lib/learn-store";
import {
  POS_BUCKETS,
  bucketFromPos,
  formatPosDisplay,
  posBucketLabel,
  type PosBucket,
} from "@/lib/pos-labels";

const JP_LEVELS = ["N5", "N4", "N3", "N2", "N1"] as const;
const EN_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

type SortKey = "az" | "za" | "level";

export default function VocabListPage() {
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
            <VocabListContent />
          </Suspense>
        </AppShell>
      )}
    </RequireAuth>
  );
}

function VocabListContent() {
  const params = useSearchParams();
  const track = (params.get("track") === "en" ? "en" : "jp") as TrackId;
  const levels = track === "jp" ? JP_LEVELS : EN_LEVELS;
  const initial = params.get("level") || levels[0];
  const [level, setLevel] = useState(initial);
  const [q, setQ] = useState("");
  const [pos, setPos] = useState<PosBucket | "all">("all");
  const [script, setScript] = useState<"all" | "kanji" | "kana">("all");
  const [starts, setStarts] = useState("");
  const [sort, setSort] = useState<SortKey>("az");

  const all = useMemo(
    () => (track === "jp" ? getJpSeed() : getEnSeed()) as VocabSeed[],
    [track],
  );

  const posCounts = useMemo(() => {
    const base = all.filter((w) => w.level === level);
    const c: Partial<Record<PosBucket, number>> = {};
    for (const w of base) {
      const b = bucketFromPos(w.pos);
      c[b] = (c[b] || 0) + 1;
    }
    return c;
  }, [all, level]);

  const filtered = useMemo(() => {
    let base = all.filter((w) => w.level === level);
    if (pos !== "all") base = base.filter((w) => bucketFromPos(w.pos) === pos);
    if (track === "jp" && script === "kanji") {
      base = base.filter((w) => /[\u4e00-\u9fff]/.test(w.word));
    }
    if (track === "jp" && script === "kana") {
      base = base.filter((w) => !/[\u4e00-\u9fff]/.test(w.word));
    }
    const st = starts.trim().toLowerCase();
    if (st) {
      base = base.filter(
        (w) =>
          w.word.toLowerCase().startsWith(st) ||
          (w.reading || "").startsWith(st) ||
          (w.romaji || "").toLowerCase().startsWith(st),
      );
    }
    const s = q.trim().toLowerCase();
    if (s) {
      base = base.filter(
        (w) =>
          w.word.toLowerCase().includes(s) ||
          (w.reading || "").includes(s) ||
          (w.romaji || "").toLowerCase().includes(s) ||
          (w.pos || "").toLowerCase().includes(s) ||
          w.meanings.some((m) => m.toLowerCase().includes(s)),
      );
    }
    const sorted = [...base];
    if (sort === "az") sorted.sort((a, b) => a.word.localeCompare(b.word, track === "jp" ? "ja" : "en"));
    if (sort === "za") sorted.sort((a, b) => b.word.localeCompare(a.word, track === "jp" ? "ja" : "en"));
    return sorted;
  }, [all, level, pos, script, starts, q, sort, track]);

  return (
    <div className="page">
      <Link href="/learn" className="back">
        ← Về học
      </Link>
      <div className="page-head">
        <div>
          <p className="eyebrow">Danh sách học liệu</p>
          <h1>{track === "jp" ? "Từ vựng JLPT" : "Từ vựng CEFR-J"}</h1>
          <p>Lọc cấp · loại từ · chữ viết · sắp xếp — dữ liệu offline đầy đủ.</p>
        </div>
        <div className="quota">
          {level}
          <br />
          <strong>{filtered.length} từ</strong>
        </div>
      </div>

      <div className="level-tabs">
        {levels.map((lv) => (
          <button
            key={lv}
            type="button"
            className={level === lv ? "chip map-chip active" : "chip map-chip"}
            onClick={() => {
              setLevel(lv);
              setPos("all");
            }}
          >
            {lv}
          </button>
        ))}
      </div>

      <div className="catalog-filters">
        <label className="culture-search catalog-filter-grow">
          Tìm trong {level}
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={
              track === "jp" ? "kanji, kana, romaji, nghĩa…" : "word, nghĩa, loại từ…"
            }
          />
        </label>
        <label>
          Bắt đầu bằng
          <input
            value={starts}
            onChange={(e) => setStarts(e.target.value)}
            placeholder={track === "jp" ? "あ / a / 食…" : "ab…"}
          />
        </label>
        <label>
          Loại từ
          <select value={pos} onChange={(e) => setPos(e.target.value as PosBucket | "all")}>
            <option value="all">Tất cả</option>
            {POS_BUCKETS.map((b) => (
              <option key={b} value={b}>
                {posBucketLabel(b)}
                {posCounts[b] ? ` (${posCounts[b]})` : ""}
              </option>
            ))}
          </select>
        </label>
        {track === "jp" ? (
          <label>
            Chữ viết
            <select value={script} onChange={(e) => setScript(e.target.value as typeof script)}>
              <option value="all">Tất cả</option>
              <option value="kanji">Có kanji</option>
              <option value="kana">Chỉ kana</option>
            </select>
          </label>
        ) : null}
        <label>
          Sắp xếp
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <option value="az">A → Z</option>
            <option value="za">Z → A</option>
          </select>
        </label>
      </div>

      <div className="level-tabs filter-chips">
        <button
          type="button"
          className={pos === "all" ? "chip map-chip active" : "chip map-chip"}
          onClick={() => setPos("all")}
        >
          All POS
        </button>
        {POS_BUCKETS.filter((b) => (posCounts[b] || 0) > 0).map((b) => (
          <button
            key={b}
            type="button"
            className={pos === b ? "chip map-chip active" : "chip map-chip"}
            onClick={() => setPos(b)}
          >
            {posBucketLabel(b)} · {posCounts[b]}
          </button>
        ))}
      </div>

      <div className="catalog-list">
        {filtered.slice(0, 400).map((w) => (
          <article key={w.id} className="catalog-row">
            <div>
              <strong lang={track === "jp" ? "ja" : "en"}>{w.word}</strong>
              {w.reading ? <span className="reading-inline">{w.reading}</span> : null}
            </div>
            <p>{w.meanings.slice(0, 2).join(" · ")}</p>
            <small>
              {w.level}
              {w.pos ? ` · ${formatPosDisplay(w.pos)}` : ` · ${posBucketLabel(bucketFromPos(w.pos))}`}
            </small>
          </article>
        ))}
      </div>
      {filtered.length === 0 ? (
        <p className="empty-hint">Không khớp bộ lọc — thử xóa loại từ / ô tìm.</p>
      ) : null}
      {filtered.length > 400 ? (
        <p className="empty-hint">
          Hiển thị 400/{filtered.length} — thu hẹp lọc để xem đủ.
        </p>
      ) : null}
    </div>
  );
}
