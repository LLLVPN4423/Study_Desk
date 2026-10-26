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
import { savePlacement, type TrackId } from "@/lib/learn-store";
import {
  DEFAULT_PATH_GOALS,
  type PathGoalFocus,
  type PathGoals,
  type PathIntensity,
  type PathSkill,
} from "@/lib/path-goals";
import {
  buildPlacementStages,
  goalsFromPlacement,
  pickStage2,
  scorePlacement,
  shiftBand,
  type PlacementQuestion,
  type PlacementResult,
} from "@/lib/placement";
import { canSpeak, speak } from "@/lib/speech";

type Phase = "goals" | "quiz" | "result";

export default function PlacementPage() {
  return (
    <RequireAuth>
      {(user) => (
        <AppShell userName={user.name}>
          <Suspense
            fallback={
              <div className="page">
                <h1>Loading…</h1>
              </div>
            }
          >
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
  const bank = (track === "jp" ? jpQuestions : enQuestions) as PlacementQuestion[];

  const stages = useMemo(() => buildPlacementStages(track, bank), [track, bank]);
  const [phase, setPhase] = useState<Phase>("goals");
  const [goalsDraft, setGoalsDraft] = useState<PathGoals>({
    ...DEFAULT_PATH_GOALS,
    focus: track === "jp" ? "jlpt" : "exam_en",
  });

  const [queue, setQueue] = useState<PlacementQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | undefined>();
  const [answered, setAnswered] = useState<{ q: PlacementQuestion; correct: boolean }[]>(
    [],
  );
  const [stage1Done, setStage1Done] = useState(false);
  const [result, setResult] = useState<PlacementResult | null>(null);
  const [bandPick, setBandPick] = useState<string | null>(null);
  const [finalGoals, setFinalGoals] = useState<PathGoals | null>(null);

  const q = queue[index];
  const progress = queue.length
    ? ((index + (phase === "result" ? 1 : 0)) / queue.length) * 100
    : 0;

  function toggleSkill(skill: PathSkill) {
    setGoalsDraft((g) => {
      const has = g.skills.includes(skill);
      const skills = has ? g.skills.filter((s) => s !== skill) : [...g.skills, skill];
      return { ...g, skills: skills.length ? skills : ["vocab"] };
    });
  }

  function startQuiz() {
    setQueue(stages.stage1);
    setIndex(0);
    setSelected(undefined);
    setAnswered([]);
    setStage1Done(false);
    setPhase("quiz");
  }

  function finishWith(rows: { q: PlacementQuestion; correct: boolean }[]) {
    const scored = scorePlacement(track, rows);
    const goals = goalsFromPlacement(track, goalsDraft, scored);
    setResult(scored);
    setBandPick(scored.band);
    setFinalGoals(goals);
    setPhase("result");
  }

  function next() {
    if (selected === undefined || !q) return;
    const isCorrect = selected === q.answer;
    const rows = [...answered, { q, correct: isCorrect }];
    if (index + 1 >= queue.length) {
      if (!stage1Done && (stages.stage2Easy.length || stages.stage2Hard.length)) {
        const stage1Correct = rows.filter((r) => r.correct).length;
        const stage2 = pickStage2(
          stage1Correct,
          rows.length,
          stages.stage2Easy,
          stages.stage2Hard,
        );
        if (stage2.length) {
          setAnswered(rows);
          setStage1Done(true);
          setQueue(stage2);
          setIndex(0);
          setSelected(undefined);
          return;
        }
      }
      finishWith(rows);
      return;
    }
    setAnswered(rows);
    setIndex(index + 1);
    setSelected(undefined);
  }

  function confirmPlacement() {
    if (!bandPick || !finalGoals) return;
    savePlacement(track, bandPick, finalGoals);
    router.push(`/learn?track=${track}`);
  }

  if (phase === "goals") {
    return (
      <div className="page narrow">
        <Link href="/learn" className="back">
          ← Về học
        </Link>
        <p className="eyebrow">Placement · {track.toUpperCase()}</p>
        <h1>Nhu cầu học của bạn</h1>
        <p style={{ color: "var(--muted)", margin: "8px 0 20px" }}>
          Chọn mục tiêu trước — bài test ước lượng band. Sau đó bạn tự chọn thêm bài dần trên
          trang Học (không bắt buộc dựng cả lộ trình ngay).
        </p>

        <label className="field-block">
          <span>Mục tiêu chính</span>
          <select
            value={goalsDraft.focus}
            onChange={(e) =>
              setGoalsDraft((g) => ({ ...g, focus: e.target.value as PathGoalFocus }))
            }
          >
            {track === "jp" ? <option value="jlpt">Thi JLPT</option> : null}
            {track === "en" ? <option value="exam_en">Thi / chứng chỉ EN</option> : null}
            <option value="daily">Giao tiếp / học hàng ngày</option>
            <option value="business">Công việc</option>
          </select>
        </label>

        <div className="field-block">
          <span>Skill ưu tiên</span>
          <div className="chip-row">
            {(
              [
                ["vocab", "Từ vựng"],
                ["grammar", "Ngữ pháp"],
                ["listening", "Nghe"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={goalsDraft.skills.includes(id) ? "chip map-chip active" : "chip map-chip"}
                onClick={() => toggleSkill(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <label className="field-block">
          <span>Cường độ</span>
          <select
            value={goalsDraft.intensity}
            onChange={(e) =>
              setGoalsDraft((g) => ({
                ...g,
                intensity: e.target.value as PathIntensity,
              }))
            }
          >
            <option value="light">Nhẹ (ít tuần hơn)</option>
            <option value="standard">Chuẩn</option>
            <option value="intense">Đậm (thêm SRS)</option>
          </select>
        </label>

        <label className="field-block">
          <span>Ngày thi (tuỳ chọn)</span>
          <input
            type="date"
            value={goalsDraft.examDate || ""}
            onChange={(e) =>
              setGoalsDraft((g) => ({ ...g, examDate: e.target.value || undefined }))
            }
          />
        </label>

        <div className="actions" style={{ marginTop: 24 }}>
          <Button onClick={startQuiz}>
            Bắt đầu bài test <Icon name="arrow" />
          </Button>
        </div>
      </div>
    );
  }

  if (phase === "result" && result && bandPick && finalGoals) {
    return (
      <div className="page narrow">
        <Link href="/learn" className="back">
          ← Về học
        </Link>
        <p className="eyebrow">Kết quả · {track.toUpperCase()}</p>
        <h1>Ước lượng ~{bandPick}</h1>
        <p style={{ color: "var(--muted)", margin: "12px 0 16px" }}>
          Điểm {result.correct}/{result.total}. Không phải chứng chỉ chính thức. Chỉnh ±1 band nếu
          cần — lưu band rồi thêm bài học dần trên trang Học (không dựng cả cấp liền).
        </p>

        <div className="placement-skills">
          <div>
            <strong>Vocab</strong>
            <span>
              {result.skills.vocab.correct}/{result.skills.vocab.total || "—"}
            </span>
          </div>
          <div>
            <strong>Grammar</strong>
            <span>
              {result.skills.grammar.correct}/{result.skills.grammar.total || "—"}
            </span>
          </div>
          <div>
            <strong>Listening</strong>
            <span>
              {result.skills.listening?.correct ?? 0}/
              {result.skills.listening?.total || "—"}
            </span>
          </div>
        </div>
        {result.weak.length ? (
          <p className="empty-hint">Cần củng cố: {result.weak.join(", ")}</p>
        ) : null}
        {result.strong.length ? (
          <p className="empty-hint">Mạnh: {result.strong.join(", ")}</p>
        ) : null}

        <div className="chip-row" style={{ margin: "16px 0" }}>
          <Button
            variant="secondary"
            onClick={() => setBandPick(shiftBand(track, bandPick, -1))}
          >
            Band thấp hơn
          </Button>
          <strong style={{ alignSelf: "center" }}>{bandPick}</strong>
          <Button
            variant="secondary"
            onClick={() => setBandPick(shiftBand(track, bandPick, 1))}
          >
            Band cao hơn
          </Button>
        </div>

        <p style={{ fontSize: 13, color: "var(--muted)" }}>
          Mục tiêu đã chọn: {finalGoals.focus} · {finalGoals.intensity} ·{" "}
          {finalGoals.skills.join("+")}
        </p>

        <div className="actions" style={{ marginTop: 20 }}>
          <Button onClick={confirmPlacement}>Lưu band · về trang Học</Button>
          <Button variant="secondary" onClick={() => setPhase("goals")}>
            Chỉnh nhu cầu
          </Button>
        </div>
      </div>
    );
  }

  if (!q) {
    return (
      <div className="page narrow">
        <p>Không có câu hỏi.</p>
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
          <p className="eyebrow">
            {track === "jp" ? "Japanese" : "English"} placement ·{" "}
            {stage1Done ? "Stage 2" : "Stage 1"}
          </p>
          <h1>Choose the best answer.</h1>
        </div>
        <strong>
          {index + 1} <span>/ {queue.length}</span>
        </strong>
      </div>
      <div className="progress">
        <i style={{ width: `${progress}%` }} />
      </div>
      <section className="question">
        <span className="question-label">{q.label}</span>
        {q.speak ? (
          <div style={{ margin: "12px 0" }}>
            <Button
              variant="secondary"
              onClick={() => speak(q.speak!, track === "jp" ? "ja-JP" : "en-US")}
              disabled={!canSpeak()}
            >
              {canSpeak() ? "▶ Nghe / Play audio" : "TTS unavailable"}
            </Button>
            <p className="translation" style={{ marginTop: 8 }}>
              {q.prompt}
            </p>
          </div>
        ) : (
          <>
            <p className="jp large">{q.prompt}</p>
            <p className="translation">{q.translation || q.hint}</p>
          </>
        )}
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
          <p>Approximate band only — not a certified assessment.</p>
          <Button variant={selected === undefined ? "disabled" : "primary"} onClick={next}>
            {index + 1 >= queue.length ? "Finish stage" : "Next"} <Icon name="arrow" />
          </Button>
        </div>
      </section>
    </div>
  );
}
