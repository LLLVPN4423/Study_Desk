"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { RequireAuth } from "@/components/RequireAuth";
import mockJp from "@/data/mocks-jp.json";
import mockEn from "@/data/mocks-en.json";
import listenJp from "@/data/mocks-listening-jp.json";
import listenEn from "@/data/mocks-listening-en.json";
import { FREE_LIMITS } from "@/lib/freemium";
import { canTakeMock, loadLearn, recordMockTaken, type TrackId } from "@/lib/learn-store";
import { speak } from "@/lib/speech";

type MockQ = {
  id: string;
  prompt: string;
  choices: string[];
  answer: number;
  speak?: string;
};
type Mock = {
  id: string;
  title: string;
  track: string;
  minutes: number;
  disclaimer: string;
  mode?: string;
  questions: MockQ[];
};

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
  const [mode, setMode] = useState<"vocab" | "listening">("vocab");
  const mock = (
    mode === "listening"
      ? track === "jp"
        ? listenJp
        : listenEn
      : track === "jp"
        ? mockJp
        : mockEn
  ) as Mock;

  const [started, setStarted] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(mock.minutes * 60);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | undefined>();
  const [correct, setCorrect] = useState(0);
  const [finished, setFinished] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [used, setUsed] = useState(0);

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
  }, [mode, track, mock.minutes]);

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
        <p style={{ color: "var(--muted)", margin: "12px 0 20px" }}>
          {mock.disclaimer} · {mock.minutes} phút · {mock.questions.length} câu.
        </p>
        <p style={{ fontSize: 13, marginBottom: 24 }}>
          Free: {used}/{FREE_LIMITS.mocksPerMonth} mock ngắn / tháng
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
        <Link href="/learn" className="back">
          ← Về học
        </Link>
        <p className="eyebrow">Xong mock</p>
        <h1>
          {correct}/{mock.questions.length}
        </h1>
        <p style={{ color: "var(--muted)", marginTop: 12 }}>
          Còn {timerLabel}. Kết quả luyện không chính thức.
        </p>
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
