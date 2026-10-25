"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { RequireAuth } from "@/components/RequireAuth";
import grammarEn from "@/data/grammar-en.json";
import grammarJp from "@/data/grammar-jp.json";
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
  tags?: string[];
};

const JP_LEVELS = ["N5", "N4", "N3", "N2", "N1"] as const;
const EN_LEVELS = ["A1", "A2", "B1", "B2", "C1"] as const;

const TAG_VI: Record<string, string> = {
  particle: "Trợ từ",
  topic: "Chủ đề",
  time: "Thời gian",
  formal: "Trang trọng",
  casual: "Thân mật",
  written: "Văn viết",
  negation: "Phủ định",
  condition: "Điều kiện",
  reason: "Nguyên nhân",
  degree: "Mức độ",
  concession: "Nhượng bộ",
  emphasis: "Nhấn mạnh",
  emotion: "Cảm xúc",
  manner: "Cách thức",
  sequence: "Trình tự",
  conjecture: "Phỏng đoán",
  relation: "Quan hệ",
  addition: "Bổ sung",
  result: "Kết quả",
  change: "Thay đổi",
  criticism: "Phê bình",
};

export default function GrammarPage() {
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
  const levels = track === "jp" ? JP_LEVELS : EN_LEVELS;
  const viewList = params.get("view") === "list";
  const levelParam = params.get("level");
  const [level, setLevel] = useState<string | "all">(
    levelParam && (levels as readonly string[]).includes(levelParam) ? levelParam : "all",
  );
  const [view, setView] = useState<"list" | "drill">(viewList ? "list" : "drill");
  const [qText, setQText] = useState("");
  const [tag, setTag] = useState<string | "all">("all");

  const all = useMemo(
    () => (track === "jp" ? grammarJp : grammarEn) as G[],
    [track],
  );

  const tagOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const g of all) {
      if (level !== "all" && g.level !== level) continue;
      for (const t of g.tags || []) counts.set(t, (counts.get(t) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24);
  }, [all, level]);

  const bank = useMemo(() => {
    let list = level === "all" ? all : all.filter((g) => g.level === level);
    if (tag !== "all") list = list.filter((g) => (g.tags || []).includes(tag));
    const s = qText.trim().toLowerCase();
    if (s) {
      list = list.filter(
        (g) =>
          g.pattern.toLowerCase().includes(s) ||
          g.meaning.toLowerCase().includes(s) ||
          g.prompt.toLowerCase().includes(s) ||
          g.note.toLowerCase().includes(s) ||
          (g.tags || []).some((t) => t.toLowerCase().includes(s)),
      );
    }
    return list;
  }, [all, level, tag, qText]);

  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | undefined>();
  const [correct, setCorrect] = useState(0);
  const [done, setDone] = useState(false);
  const [revealed, setRevealed] = useState(false);

  function resetDrill() {
    setIndex(0);
    setSelected(undefined);
    setCorrect(0);
    setDone(false);
    setRevealed(false);
  }

  function changeLevel(lv: string | "all") {
    setLevel(lv);
    setTag("all");
    resetDrill();
  }

  const q = bank[index];

  if (view === "list") {
    return (
      <div className="page">
        <Link href="/learn" className="back">
          ← Về học
        </Link>
        <div className="page-head">
          <div>
            <p className="eyebrow">Danh sách học liệu</p>
            <h1>Ngữ pháp {track === "jp" ? "JLPT" : "CEFR-style"}</h1>
            <p>Lọc cấp · nhãn chủ đề · tìm mẫu — bấm một dòng để drill.</p>
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              setView("drill");
              resetDrill();
            }}
          >
            Vào drills ({bank.length})
          </Button>
        </div>
        <div className="level-tabs">
          <button
            type="button"
            className={level === "all" ? "chip map-chip active" : "chip map-chip"}
            onClick={() => changeLevel("all")}
          >
            Tất cả
          </button>
          {levels.map((lv) => (
            <button
              key={lv}
              type="button"
              className={level === lv ? "chip map-chip active" : "chip map-chip"}
              onClick={() => changeLevel(lv)}
            >
              {lv} ({all.filter((g) => g.level === lv).length})
            </button>
          ))}
        </div>

        <div className="catalog-filters">
          <label className="culture-search catalog-filter-grow">
            Tìm mẫu / nghĩa / ghi chú
            <input
              value={qText}
              onChange={(e) => setQText(e.target.value)}
              placeholder={track === "jp" ? "〜は, particle, topic…" : "present, conditional…"}
            />
          </label>
          {tagOptions.length ? (
            <label>
              Chủ đề / nhãn
              <select value={tag} onChange={(e) => setTag(e.target.value)}>
                <option value="all">Tất cả nhãn</option>
                {tagOptions.map(([t, n]) => (
                  <option key={t} value={t}>
                    {TAG_VI[t] || t} ({n})
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        {tagOptions.length ? (
          <div className="level-tabs filter-chips">
            <button
              type="button"
              className={tag === "all" ? "chip map-chip active" : "chip map-chip"}
              onClick={() => setTag("all")}
            >
              All tags
            </button>
            {tagOptions.slice(0, 12).map(([t, n]) => (
              <button
                key={t}
                type="button"
                className={tag === t ? "chip map-chip active" : "chip map-chip"}
                onClick={() => setTag(t)}
              >
                {TAG_VI[t] || t} · {n}
              </button>
            ))}
          </div>
        ) : null}

        <p className="culture-filter-status">
          Đang xem: <strong>{bank.length}</strong> mẫu
          {tag !== "all" ? ` · ${TAG_VI[tag] || tag}` : null}
        </p>

        <div className="catalog-list">
          {bank.map((g) => (
            <button
              key={g.id}
              type="button"
              className="catalog-row catalog-button"
              onClick={() => {
                const idx = bank.findIndex((x) => x.id === g.id);
                setIndex(Math.max(0, idx));
                setSelected(undefined);
                setRevealed(false);
                setDone(false);
                setCorrect(0);
                setView("drill");
              }}
            >
              <div>
                <strong>{g.pattern}</strong>
                <span className="reading-inline">{g.level}</span>
              </div>
              <p>{g.meaning}</p>
              <small>
                {(g.tags || []).slice(0, 3).map((t) => TAG_VI[t] || t).join(" · ") || g.prompt}
              </small>
            </button>
          ))}
        </div>
        {!bank.length ? <p className="empty-hint">Không khớp bộ lọc.</p> : null}
      </div>
    );
  }

  if (!bank.length || !q) {
    return (
      <div className="page narrow">
        <Link href="/learn" className="back">
          ← Về học
        </Link>
        <h1>Chưa có drill</h1>
        <Button onClick={() => setView("list")}>Xem danh sách</Button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="page narrow">
        <Link href="/learn" className="back">
          ← Về học
        </Link>
        <p className="eyebrow">Grammar · {track.toUpperCase()}</p>
        <h1>Xong drills</h1>
        <p style={{ color: "var(--muted)", margin: "12px 0 24px" }}>
          {correct}/{bank.length} đúng · luyện không chính thức.
        </p>
        <div className="actions">
          <Button onClick={resetDrill}>Làm lại</Button>
          <Button variant="secondary" onClick={() => setView("list")}>
            Danh sách
          </Button>
        </div>
      </div>
    );
  }

  function submit() {
    if (selected === undefined) return;
    if (selected === q.answer) setCorrect((c) => c + 1);
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

  return (
    <div className="page narrow">
      <Link href="/learn" className="back">
        ← Về học
      </Link>
      <div className="level-tabs" style={{ marginBottom: 16 }}>
        <button type="button" className="chip map-chip" onClick={() => setView("list")}>
          Danh sách
        </button>
        <button
          type="button"
          className={level === "all" ? "chip map-chip active" : "chip map-chip"}
          onClick={() => changeLevel("all")}
        >
          All
        </button>
        {levels.map((lv) => (
          <button
            key={lv}
            type="button"
            className={level === lv ? "chip map-chip active" : "chip map-chip"}
            onClick={() => changeLevel(lv)}
          >
            {lv}
          </button>
        ))}
      </div>
      <div className="test-head">
        <div>
          <p className="eyebrow">
            Grammar · {track.toUpperCase()} · {q.level}
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
        {revealed ? (
          <p
            style={{
              marginTop: 16,
              fontSize: 13,
              color: selected === q.answer ? "var(--success, #2f6b4f)" : "var(--danger)",
            }}
          >
            {selected === q.answer ? "Đúng." : `Đáp án: ${q.choices[q.answer]}`}
          </p>
        ) : null}
        <div className="question-foot">
          <p>Luyện dạng không chính thức.</p>
          {!revealed ? (
            <Button variant={selected === undefined ? "disabled" : "primary"} onClick={submit}>
              Kiểm tra
            </Button>
          ) : (
            <Button onClick={next}>
              {index + 1 >= bank.length ? "Xong" : "Câu sau"} <Icon name="arrow" />
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}
