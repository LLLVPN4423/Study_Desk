"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { RequireAuth } from "@/components/RequireAuth";
import grammarJp from "@/data/grammar-jp.json";
import grammarEn from "@/data/grammar-en.json";
import type { TrackId } from "@/lib/learn-store";

type G = {
  id: string;
  level: string;
  pattern: string;
  prompt: string;
  meaning: string;
  choices: string[];
  answer: number;
  note: string;
};

export default function GrammarPage() {
  return (
    <RequireAuth>
      {(user) => (
        <AppShell userName={user.name}>
          <Suspense fallback={<div className="page"><h1>Loading…</h1></div>}>
            <GrammarContent />
          </Suspense>
        </AppShell>
      )}
    </RequireAuth>
  );
}

function GrammarContent() {
  const params = useSearchParams();
  const track = (params.get("track") === "en" ? "en" : "jp") as TrackId;
  const bank = useMemo(
    () => (track === "jp" ? grammarJp : grammarEn) as G[],
    [track],
  );
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | undefined>();
  const [correct, setCorrect] = useState(0);
  const [done, setDone] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const q = bank[index];

  function submit() {
    if (selected === undefined) return;
    const ok = selected === q.answer;
    if (ok) setCorrect((c) => c + 1);
    setRevealed(true);
  }

  function next() {
    if (index + 1 >= bank.length) {
      setDone(true);
      return;
    }
    setIndex(index + 1);
    setSelected(undefined);
    setRevealed(false);
  }

  if (done) {
    return (
      <div className="page narrow">
        <Link href="/learn" className="back">
          ← Back to learn
        </Link>
        <p className="eyebrow">Grammar · {track.toUpperCase()}</p>
        <h1>Drill complete</h1>
        <p style={{ color: "var(--muted)", margin: "12px 0 24px" }}>
          {correct}/{bank.length} correct. Unofficial practice only.
        </p>
        <Button
          onClick={() => {
            setIndex(0);
            setCorrect(0);
            setDone(false);
            setSelected(undefined);
            setRevealed(false);
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="page narrow">
      <Link href="/learn" className="back">
        ← Back to learn
      </Link>
      <div className="test-head">
        <div>
          <p className="eyebrow">
            Grammar drills · {track.toUpperCase()} · {q.level}
          </p>
          <h1>{q.pattern}</h1>
        </div>
        <strong>
          {index + 1} <span>/ {bank.length}</span>
        </strong>
      </div>
      <div className="progress">
        <i style={{ width: `${((index + 1) / bank.length) * 100}%` }} />
      </div>
      <section className="question">
        <span className="question-label">{q.meaning}</span>
        <p className="jp large">{q.prompt}</p>
        <p className="translation">{q.note}</p>
        <div className="choices">
          {q.choices.map((a, i) => (
            <button
              key={a + i}
              type="button"
              className={selected === i ? "selected" : ""}
              disabled={revealed}
              onClick={() => setSelected(i)}
            >
              <span>{String.fromCharCode(65 + i)}</span>
              {a}
            </button>
          ))}
        </div>
        {revealed && (
          <p style={{ marginTop: 16, fontSize: 13, color: selected === q.answer ? "var(--success)" : "var(--danger)" }}>
            {selected === q.answer ? "Correct." : `Answer: ${q.choices[q.answer]}`}
          </p>
        )}
        <div className="question-foot">
          <p>Unofficial format-similar practice — not exam content.</p>
          {!revealed ? (
            <Button variant={selected === undefined ? "disabled" : "primary"} onClick={submit}>
              Check
            </Button>
          ) : (
            <Button onClick={next}>
              {index + 1 >= bank.length ? "Finish" : "Next"} <Icon name="arrow" />
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}
