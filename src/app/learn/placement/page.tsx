"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { RequireAuth } from "@/components/RequireAuth";
import jpQuestions from "@/data/placement-jp.json";
import enQuestions from "@/data/placement-en.json";
import { activatePath, type TrackId } from "@/lib/learn-store";

type Q = {
  id: string;
  bandHint: string;
  label: string;
  prompt: string;
  translation?: string;
  hint?: string;
  choices: string[];
  answer: number;
};

function scoreToBand(track: TrackId, correct: number, total: number) {
  const ratio = correct / total;
  if (track === "jp") {
    if (ratio < 0.3) return "N5";
    if (ratio < 0.5) return "N4";
    if (ratio < 0.7) return "N3";
    if (ratio < 0.85) return "N2";
    return "N1";
  }
  if (ratio < 0.35) return "A2";
  if (ratio < 0.55) return "B1";
  if (ratio < 0.75) return "B2";
  return "C1";
}

export default function PlacementPage() {
  return (
    <RequireAuth>
      {(user) => (
        <AppShell userName={user.name}>
          <Suspense fallback={<div className="page"><h1>Loading…</h1></div>}>
            <PlacementContent />
          </Suspense>
        </AppShell>
      )}
    </RequireAuth>
  );
}

function PlacementContent() {
  const router = useRouter();
  const params = useSearchParams();
  const track = (params.get("track") === "en" ? "en" : "jp") as TrackId;
  const bank = (track === "jp" ? jpQuestions : enQuestions) as Q[];
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | undefined>();
  const [correct, setCorrect] = useState(0);
  const [finished, setFinished] = useState(false);
  const [band, setBand] = useState<string | null>(null);

  const q = bank[index];
  const progress = useMemo(
    () => ((index + (finished ? 1 : 0)) / bank.length) * 100,
    [index, finished, bank.length],
  );

  function next() {
    if (selected === undefined) return;
    const isCorrect = selected === q.answer;
    const nextCorrect = correct + (isCorrect ? 1 : 0);
    if (index + 1 >= bank.length) {
      const result = scoreToBand(track, nextCorrect, bank.length);
      activatePath(track, result);
      setCorrect(nextCorrect);
      setBand(result);
      setFinished(true);
      return;
    }
    setCorrect(nextCorrect);
    setIndex(index + 1);
    setSelected(undefined);
  }

  if (finished && band) {
    return (
      <div className="page narrow">
        <Link href="/learn" className="back">
          ← Back to learn
        </Link>
        <p className="eyebrow">Placement complete · {track.toUpperCase()}</p>
        <h1>Approx. {band}</h1>
        <p style={{ color: "var(--muted)", margin: "12px 0 28px" }}>
          Score {correct}/{bank.length}. Unofficial practice estimate — not a certified{" "}
          {track === "jp" ? "JLPT" : "IELTS/CEFR"} result. Your path and FSRS deck are ready.
        </p>
        <div className="actions">
          <Button onClick={() => router.push(`/learn/roadmap?track=${track}`)}>View roadmap</Button>
          <Button variant="secondary" onClick={() => router.push(`/learn/review?track=${track}`)}>
            Start reviews
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="page narrow">
      <Link href="/learn" className="back">
        ← Leave placement
      </Link>
      <div className="test-head">
        <div>
          <p className="eyebrow">{track === "jp" ? "Japanese" : "English"} placement</p>
          <h1>Choose the best answer.</h1>
        </div>
        <strong>
          {index + 1} <span>/ {bank.length}</span>
        </strong>
      </div>
      <div className="progress">
        <i style={{ width: `${progress}%` }} />
      </div>
      <section className="question">
        <span className="question-label">{q.label}</span>
        <p className={track === "jp" ? "jp large" : "jp large"}>{q.prompt}</p>
        <p className="translation">{q.translation || q.hint}</p>
        <div className="choices">
          {q.choices.map((a, i) => (
            <button
              key={a + i}
              type="button"
              className={selected === i ? "selected" : ""}
              onClick={() => setSelected(i)}
            >
              <span>{String.fromCharCode(65 + i)}</span>
              {a}
            </button>
          ))}
        </div>
        <div className="question-foot">
          <p>Results show an approximate band only. This is not a certified assessment.</p>
          <Button variant={selected === undefined ? "disabled" : "primary"} onClick={next}>
            {index + 1 >= bank.length ? "Finish" : "Next question"} <Icon name="arrow" />
          </Button>
        </div>
      </section>
    </div>
  );
}
