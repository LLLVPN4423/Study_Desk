"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { RequireAuth } from "@/components/RequireAuth";
import { FREE_LIMITS } from "@/lib/freemium";
import {
  canTakeMock,
  getTrack,
  loadLearn,
  pathOverallProgress,
  recordMockEvidence,
  recordMockTaken,
  recordStudyMinutes,
  type TrackId,
} from "@/lib/learn-store";
import { bandsForTrack, resolveMockPack, type MockPack } from "@/lib/mocks-band";
import { speak } from "@/lib/speech";

export default function MocksPage() {
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
            <MocksContent plan={user.plan} />
          </Suspense>
        </AppShell>
      )}
    </RequireAuth>
  );
}

function MocksContent({ plan }: { plan: "free" | "pro" }) {
  const params = useSearchParams();
  const track = (params.get("track") === "en" ? "en" : "jp") as TrackId;
  const modeParam = params.get("mode") === "listening" ? "listening" : "vocab";
  const bandParam = params.get("band");
  const [mode, setMode] = useState<"vocab" | "listening">(modeParam);
  const [band, setBand] = useState<string>(() => {
    if (bandParam) return bandParam;
    const t = getTrack(loadLearn(), track);
    return t.band || (track === "jp" ? "N5" : "A2");
  });
  useEffect(() => {
    setMode(modeParam);
  }, [modeParam]);
  useEffect(() => {
    if (bandParam) {
      setBand(bandParam);
      return;
    }
    const t = getTrack(loadLearn(), track);
    if (t.band) setBand(t.band);
  }, [bandParam, track]);
  const mock = useMemo(
    () => resolveMockPack(track, mode, band) as MockPack,
    [track, mode, band],
  );

  const [started, setStarted] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(mock.minutes * 60);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | undefined>();
  const [correct, setCorrect] = useState(0);
  const [finished, setFinished] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [used, setUsed] = useState(0);
  const mockStart = useRef(Date.now());
  const loggedFinish = useRef(false);

  useEffect(() => {
    const s = loadLearn();
    setUsed(s.mocksThisMonth);
    setBlocked(!canTakeMock(s) && plan === "free");
  }, [plan]);

  useEffect(() => {
    setStarted(false);
    setFinished(false);
    setIndex(0);
    setSelected(undefined);
    setCorrect(0);
    setSecondsLeft(mock.minutes * 60);
    loggedFinish.current = false;
  }, [mode, track, band, mock.id, mock.minutes]);

  const [pathMsg, setPathMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!finished || loggedFinish.current) return;
    loggedFinish.current = true;
    const score = mock.questions.length
      ? Math.round((correct / mock.questions.length) * 100)
      : 0;
    const st = recordMockEvidence(
      track,
      mode === "listening" ? "listening" : "vocab",
      score,
    );
    recordStudyMinutes((Date.now() - mockStart.current) / 60000);
    setPathMsg(
      score >= 40
        ? `Mock ${score}% · lộ trình ${pathOverallProgress(track, st)}%.`
        : `Mock ${score}% — cần ≥40% để hoàn thành việc mock trên lộ trình.`,
    );
  }, [finished, correct, mock.questions.length, mode, track]);

  useEffect(() => {
    if (!started || finished) return;
    if (secondsLeft <= 0) {
      setFinished(true);
      return;
    }
    const id = window.setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearInterval(id);
  }, [started, finished, secondsLeft]);

  const timerLabel = useMemo(() => {
    const m = Math.floor(secondsLeft / 60)
      .toString()
      .padStart(2, "0");
    const s = (secondsLeft % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }, [secondsLeft]);

  function start() {
    if (blocked) return;
    recordMockTaken();
    setUsed((u) => u + 1);
    mockStart.current = Date.now();
    loggedFinish.current = false;
    setStarted(true);
    const first = mock.questions[0];
    if (mode === "listening" && first?.speak) {
      speak(first.speak, track === "jp" ? "ja-JP" : "en-US");
    }
  }

  function next() {
    if (selected === undefined) return;
    const q = mock.questions[index];
    const nextCorrect = correct + (selected === q.answer ? 1 : 0);
    if (index + 1 >= mock.questions.length) {
      setCorrect(nextCorrect);
      setFinished(true);
      return;
    }
    setCorrect(nextCorrect);
    const ni = index + 1;
    setIndex(ni);
    setSelected(undefined);
    const nq = mock.questions[ni];
    if (mode === "listening" && nq?.speak) {
      speak(nq.speak, track === "jp" ? "ja-JP" : "en-US");
    }
  }

  if (!started) {
    return (
      <div className="page narrow">
        <Link href="/learn" className="back">
          ← Về học
        </Link>
        <p className="eyebrow">Mocks · {track.toUpperCase()}</p>
        <h1>Luyện có đồng hồ</h1>
        <div className="segmented" style={{ margin: "16px 0" }}>
          <button
            type="button"
            className={mode === "vocab" ? "active" : ""}
            onClick={() => setMode("vocab")}
          >
            Từ vựng
          </button>
          <button
            type="button"
            className={mode === "listening" ? "active" : ""}
            onClick={() => setMode("listening")}
          >
            Nghe (TTS)
          </button>
        </div>
        <p style={{ color: "var(--muted)", margin: "12px 0 12px" }}>
          {mock.disclaimer} · {mock.minutes} phút · {mock.questions.length} câu · band{" "}
          <strong>{band}</strong>
          {mock.band ? "" : " (fallback)"}.
        </p>
        <label className="field" style={{ display: "block", marginBottom: 16, maxWidth: 220 }}>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>Cấp mock</span>
          <select
            value={band}
            onChange={(e) => setBand(e.target.value)}
            style={{ display: "block", width: "100%", marginTop: 6 }}
          >
            {bandsForTrack(track).map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>
        <p style={{ fontSize: 13, marginBottom: 24 }}>
          Mock tháng: {used}/{FREE_LIMITS.mocksPerMonth}
          {plan === "pro" ? " · Pro không giới hạn" : ""}.
        </p>
        {blocked ? (
          <p style={{ color: "var(--danger)" }}>
            Đã dùng hết mock Free tháng này. Bật Pro flag hoặc đợi tháng sau.
          </p>
        ) : (
          <Button onClick={start}>
            Bắt đầu <Icon name="play" />
          </Button>
        )}
      </div>
    );
  }

  if (finished) {
    return (
      <div className="page narrow">
        <Link href={`/learn?track=${track}`} className="back">
          ← Về lộ trình
        </Link>
        <p className="eyebrow">Xong mock</p>
        <h1>
          {correct}/{mock.questions.length}
        </h1>
        <p style={{ color: "var(--muted)", marginTop: 12 }}>
          Còn {timerLabel}. Kết quả luyện không chính thức.
        </p>
        {pathMsg ? <p className="empty-hint">{pathMsg}</p> : null}
        <div className="actions" style={{ marginTop: 16 }}>
          <Link href={`/learn?track=${track}`}>
            <Button>Về lộ trình</Button>
          </Link>
        </div>
      </div>
    );
  }

  const q = mock.questions[index];

  return (
    <div className="page narrow">
      <div className="test-head">
        <div>
          <p className="eyebrow">{mock.title}</p>
          <h1>Đồng hồ đang chạy</h1>
        </div>
        <strong style={{ color: secondsLeft < 60 ? "var(--danger)" : undefined }}>
          {timerLabel}
        </strong>
      </div>
      <div className="progress">
        <i style={{ width: `${((index + 1) / mock.questions.length) * 100}%` }} />
      </div>
      <section className="question">
        <span className="question-label">
          Câu {index + 1} / {mock.questions.length}
        </span>
        {mode === "listening" && q.speak && (
          <div className="speak-row" style={{ justifyContent: "flex-start", margin: "16px 0" }}>
            <Button
              variant="secondary"
              onClick={() => speak(q.speak || "", track === "jp" ? "ja-JP" : "en-US")}
            >
              Nghe lại
            </Button>
          </div>
        )}
        <p className="jp large">{q.prompt}</p>
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
          <p>{mock.disclaimer}</p>
          <Button variant={selected === undefined ? "disabled" : "primary"} onClick={next}>
            {index + 1 >= mock.questions.length ? "Nộp" : "Tiếp"} <Icon name="arrow" />
          </Button>
        </div>
      </section>
    </div>
  );
}
