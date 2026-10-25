"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { RequireAuth } from "@/components/RequireAuth";
import n5 from "@/data/openjlpt-kanji-n5.json";
import n4 from "@/data/openjlpt-kanji-n4.json";
import n3 from "@/data/openjlpt-kanji-n3.json";
import n2 from "@/data/openjlpt-kanji-n2.json";
import { speak, canSpeak } from "@/lib/speech";

type Kanji = {
  character: string;
  level: string;
  meanings: string[];
  onyomi: string[];
  kunyomi: string[];
  strokes?: number;
  words?: string[];
};

type Level = "N5" | "N4" | "N3" | "N2";

const banks: Record<Level, Kanji[]> = {
  N5: n5 as Kanji[],
  N4: n4 as Kanji[],
  N3: n3 as Kanji[],
  N2: n2 as Kanji[],
};

export default function KanjiPage() {
  return (
    <RequireAuth>
      {(user) => (
        <AppShell userName={user.name}>
          <KanjiContent />
        </AppShell>
      )}
    </RequireAuth>
  );
}

function KanjiContent() {
  const [level, setLevel] = useState<Level>("N5");
  const bank = banks[level];
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

  const idx = order[pos] ?? 0;
  const k = bank[idx];
  const done = pos >= bank.length;

  function changeLevel(lv: Level) {
    setLevel(lv);
    setPos(0);
    setKnown(0);
    setFlipped(false);
  }

  function next(markKnown: boolean) {
    if (markKnown) setKnown((n) => n + 1);
    setFlipped(false);
    setPos((p) => p + 1);
  }

  if (done) {
    return (
      <div className="page narrow">
        <Link href="/learn" className="back">
          ← Về học
        </Link>
        <p className="eyebrow">Kanji · {level}</p>
        <h1>Xong một vòng</h1>
        <p style={{ color: "var(--muted)", margin: "12px 0 24px" }}>
          Đã biết {known}/{bank.length}. OpenJLPT (CC BY-SA 4.0).
        </p>
        <Button
          onClick={() => {
            setPos(0);
            setKnown(0);
            setFlipped(false);
          }}
        >
          Xáo lại
        </Button>
      </div>
    );
  }

  return (
    <div className="page narrow">
      <Link href="/learn" className="back">
        ← Về học
      </Link>
      <div className="segmented" style={{ marginBottom: 18 }}>
        {(["N5", "N4", "N3", "N2"] as Level[]).map((lv) => (
          <button
            key={lv}
            type="button"
            className={level === lv ? "active" : ""}
            onClick={() => changeLevel(lv)}
          >
            {lv} ({banks[lv].length})
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
      <button
        type="button"
        className={`flashcard ${flipped ? "flipped" : ""}`}
        onClick={() => setFlipped((v) => !v)}
      >
        <span className="card-counter">{k.strokes ? `${k.strokes} nét` : level}</span>
        {flipped ? (
          <>
            <p className="eyebrow">Âm · nghĩa</p>
            <div className="reading">
              on: {k.onyomi.join(" · ") || "—"}
              <br />
              kun: {k.kunyomi.join(" · ") || "—"}
            </div>
            <h2>{k.meanings.join("; ")}</h2>
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
      {canSpeak() && (
        <div className="speak-row">
          <Button
            variant="secondary"
            onClick={() => speak(k.onyomi[0] || k.kunyomi[0] || k.character, "ja-JP")}
          >
            Nghe âm
          </Button>
        </div>
      )}
      <div className="ratings" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <button type="button" className="again" onClick={() => next(false)}>
          <strong>Chưa nhớ</strong>
          <small>Again</small>
        </button>
        <button type="button" onClick={() => next(true)}>
          <strong>Đã biết</strong>
          <small>Next</small>
        </button>
      </div>
    </div>
  );
}
