"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { RequireAuth } from "@/components/RequireAuth";
import { displayKanjiMeanings, ensureKanjiGloss } from "@/lib/gloss-vi";
import {
  ensureKanjiLevel,
  getKanjiLevel,
  type KanjiItem,
  type KanjiLevel,
} from "@/lib/curriculum-lazy";
import {
  pathOverallProgress,
  recordKanjiEvidence,
  recordStudyMinutes,
} from "@/lib/learn-store";
import { canSpeak, speak } from "@/lib/speech";

type Kanji = KanjiItem;
type Level = KanjiLevel;

const LEVELS: Level[] = ["N5", "N4", "N3", "N2", "N1"];

export default function KanjiPage() {
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
            <KanjiContent />
          </Suspense>
        </AppShell>
      )}
    </RequireAuth>
  );
}

function parseLevel(raw: string | null): Level {
  if (raw === "N4" || raw === "N3" || raw === "N2" || raw === "N1" || raw === "N5") return raw;
  return "N5";
}

function KanjiContent() {
  const params = useSearchParams();
  const [level, setLevel] = useState<Level>(() => parseLevel(params.get("level")));
  const [view, setView] = useState<"list" | "flash">(
    params.get("view") === "list" ? "list" : "flash",
  );
  const [q, setQ] = useState("");
  const [bankTick, setBankTick] = useState(0);
  const [levelCounts, setLevelCounts] = useState<Partial<Record<Level, number>>>({});

  useEffect(() => {
    setLevel(parseLevel(params.get("level")));
    if (params.get("view") === "list") setView("list");
  }, [params]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([ensureKanjiLevel(level), ensureKanjiGloss()]).then(() => {
      if (!cancelled) setBankTick((n) => n + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [level]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const counts: Partial<Record<Level, number>> = {};
      for (const lv of LEVELS) {
        const rows = await ensureKanjiLevel(lv);
        counts[lv] = rows.length;
      }
      if (!cancelled) setLevelCounts(counts);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const bank = useMemo(
    () => getKanjiLevel(level),
    // bankTick: refresh after lazy kanji load
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [level, bankTick],
  );
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return bank;
    return bank.filter(
      (k) =>
        k.character.includes(s) ||
        k.meanings.some((m) => m.toLowerCase().includes(s)) ||
        k.onyomi.some((o) => o.includes(s)) ||
        k.kunyomi.some((o) => o.includes(s)),
    );
  }, [bank, q]);

  const order = useMemo(() => {
    const keys = [...bank.keys()];
    for (let i = keys.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [keys[i], keys[j]] = [keys[j], keys[i]];
    }
    return keys;
  }, [bank, level]);

  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState(0);
  const flashStart = useRef(Date.now());
  const loggedDone = useRef(false);

  const idx = order[pos] ?? 0;
  const k = bank[idx];
  const done = pos >= bank.length;

  const [pathMsg, setPathMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!done || view !== "flash" || loggedDone.current || !bank.length) return;
    loggedDone.current = true;
    recordStudyMinutes((Date.now() - flashStart.current) / 60000);
    setPathMsg(
      known > 0
        ? `Vòng flash xong · ${known} chữ đã biết · lộ trình sẽ cập nhật tự động.`
        : "Vòng flash xong — bấm «Biết» khi học thật để tiến độ kanji tăng.",
    );
  }, [done, view, known, bank.length]);

  function changeLevel(lv: Level) {
    setLevel(lv);
    setPos(0);
    setKnown(0);
    setFlipped(false);
    setQ("");
  }

  function next(markKnown: boolean) {
    if (markKnown && k) {
      setKnown((n) => n + 1);
      const st = recordKanjiEvidence("jp", k.character, true);
      setPathMsg(`Kanji đã biết · lộ trình ${pathOverallProgress("jp", st)}%`);
    }
    setFlipped(false);
    setPos((p) => p + 1);
  }

  if (view === "list") {
    return (
      <div className="page">
        <Link href="/learn" className="back">
          ← Về học
        </Link>
        <div className="page-head">
          <div>
            <p className="eyebrow">Danh sách học liệu</p>
            <h1>Kanji OpenJLPT</h1>
            <p>Lọc N5–N1 · chuyển sang flash khi muốn ôn.</p>
          </div>
          <Button variant="secondary" onClick={() => setView("flash")}>
            Flashcards
          </Button>
        </div>
        <div className="level-tabs">
          {LEVELS.map((lv) => (
            <button
              key={lv}
              type="button"
              className={level === lv ? "chip map-chip active" : "chip map-chip"}
              onClick={() => changeLevel(lv)}
            >
              {lv} · {levelCounts[lv] ?? "…"}
            </button>
          ))}
        </div>
        <label className="culture-search">
          Tìm trong {level}
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="chữ, âm, nghĩa…"
          />
        </label>
        <div className="kanji-grid">
          {list.slice(0, 240).map((item) => (
            <article key={item.character + item.level} className="kanji-tile">
              <strong lang="ja">{item.character}</strong>
              <p>
                {displayKanjiMeanings(item.level, item.character, item.meanings)
                  .slice(0, 2)
                  .join(", ")}
              </p>
              <small>
                on {item.onyomi.slice(0, 2).join("·") || "—"} · kun{" "}
                {item.kunyomi.slice(0, 2).join("·") || "—"}
              </small>
            </article>
          ))}
        </div>
        {list.length > 240 ? (
          <p className="empty-hint">Hiển thị 240/{list.length} — thu hẹp tìm kiếm.</p>
        ) : null}
      </div>
    );
  }

  if (done) {
    return (
      <div className="page narrow">
        <Link href="/learn?track=jp" className="back">
          ← Về lộ trình
        </Link>
        <p className="eyebrow">Kanji · {level}</p>
        <h1>Xong một vòng</h1>
        <p style={{ color: "var(--muted)", margin: "12px 0 12px" }}>
          Đã biết {known}/{bank.length}. OpenJLPT (CC BY-SA 4.0).
        </p>
        {pathMsg ? <p className="empty-hint">{pathMsg}</p> : null}
        <div className="actions" style={{ marginTop: 16 }}>
          <Link href="/learn?track=jp">
            <Button>Về lộ trình</Button>
          </Link>
          <Button
            variant="secondary"
            onClick={() => {
              loggedDone.current = false;
              flashStart.current = Date.now();
              setPathMsg(null);
              setPos(0);
              setKnown(0);
              setFlipped(false);
            }}
          >
            Xáo lại
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="page narrow">
      <Link href="/learn" className="back">
        ← Về học
      </Link>
      <div className="level-tabs" style={{ marginBottom: 12 }}>
        <button type="button" className="chip map-chip" onClick={() => setView("list")}>
          Danh sách
        </button>
      </div>
      <div className="segmented" style={{ marginBottom: 18 }}>
        {LEVELS.map((lv) => (
          <button
            key={lv}
            type="button"
            className={level === lv ? "active" : ""}
            onClick={() => changeLevel(lv)}
          >
            {lv} ({levelCounts[lv] ?? "…"})
          </button>
        ))}
      </div>
      <div className="test-head">
        <div>
          <p className="eyebrow">Kanji · OpenJLPT {level}</p>
          <h1>Nhận diện & nhớ</h1>
        </div>
        <strong>
          {pos + 1} <span>/ {bank.length}</span>
        </strong>
      </div>
      <div className="progress">
        <i style={{ width: `${((pos + 1) / bank.length) * 100}%` }} />
      </div>
      <div className="review-nav">
        <button
          type="button"
          className="text-button"
          disabled={pos <= 0}
          onClick={() => {
            setFlipped(false);
            setPos((p) => Math.max(0, p - 1));
          }}
        >
          ← Trước
        </button>
        <span>
          {pos + 1} / {bank.length}
        </span>
        <button
          type="button"
          className="text-button"
          disabled={pos >= bank.length - 1}
          onClick={() => {
            setFlipped(false);
            setPos((p) => Math.min(bank.length - 1, p + 1));
          }}
        >
          Sau →
        </button>
      </div>
      <button
        type="button"
        className={`flashcard ${flipped ? "flipped" : ""}`}
        onClick={() => setFlipped((v) => !v)}
      >
        <span className="card-counter">{k.strokes ? `${k.strokes} nét` : level}</span>
        {flipped ? (
          <>
            <p className="eyebrow">Âm · nghĩa</p>
            <div className="kanji prompt-word">{k.character}</div>
            <div className="reading">
              on: {k.onyomi.join(" · ") || "—"}
              <br />
              kun: {k.kunyomi.join(" · ") || "—"}
            </div>
            <h2 className="meaning-line">
              {displayKanjiMeanings(k.level, k.character, k.meanings).join("; ")}
            </h2>
            {k.words?.length ? <p className="example">Từ: {k.words.join(" · ")}</p> : null}
          </>
        ) : (
          <>
            <p className="eyebrow">Chữ Hán</p>
            <div className="kanji">{k.character}</div>
            <span className="tap">Chạm để xem</span>
          </>
        )}
      </button>
      {canSpeak() ? (
        <div className="speak-row">
          <Button
            variant="secondary"
            onClick={() => speak(k.onyomi[0] || k.kunyomi[0] || k.character, "ja-JP")}
          >
            Nghe âm
          </Button>
        </div>
      ) : null}
      <div className={`ratings two-col ${flipped ? "enabled" : "locked"}`}>
        {!flipped ? (
          <p className="ratings-lock-hint">Lật thẻ rồi chọn Chưa nhớ / Đã biết</p>
        ) : null}
        <button type="button" className="again" disabled={!flipped} onClick={() => next(false)}>
          <strong>Chưa nhớ</strong>
          <small>Again</small>
        </button>
        <button type="button" disabled={!flipped} onClick={() => next(true)}>
          <strong>Đã biết</strong>
          <small>Next</small>
        </button>
      </div>
    </div>
  );
}
