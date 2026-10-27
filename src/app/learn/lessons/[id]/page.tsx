"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { RequireAuth } from "@/components/RequireAuth";
import grammarEn from "@/data/grammar-en.json";
import grammarJp from "@/data/grammar-jp.json";
import kanjiN1 from "@/data/openjlpt-kanji-n1.json";
import kanjiN2 from "@/data/openjlpt-kanji-n2.json";
import kanjiN3 from "@/data/openjlpt-kanji-n3.json";
import kanjiN4 from "@/data/openjlpt-kanji-n4.json";
import kanjiN5 from "@/data/openjlpt-kanji-n5.json";
import { displayGrammarMeaning, displayKanjiMeanings } from "@/lib/gloss-vi";
import { getLesson, lessonVocabIds } from "@/lib/lessons";
import {
  addLessonsToPath,
  ensureLessonCards,
  hydrateCard,
  isLessonDone,
  isLessonInPath,
  loadLearn,
  markLessonDone,
  recordGrammarEvidence,
  recordKanjiEvidence,
  recordStudyMinutes,
  type TrackId,
} from "@/lib/learn-store";

type G = {
  id: string;
  pattern: string;
  prompt: string;
  meaning: string;
  choices: string[];
  answer: number;
  note?: string;
};

type Kanji = {
  character: string;
  level?: string;
  meanings: string[];
  onyomi: string[];
  kunyomi: string[];
};

const KANJI_ALL = [
  ...(kanjiN5 as Kanji[]),
  ...(kanjiN4 as Kanji[]),
  ...(kanjiN3 as Kanji[]),
  ...(kanjiN2 as Kanji[]),
  ...(kanjiN1 as Kanji[]),
];

export default function LessonDetailPage() {
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
            <LessonDetail />
          </Suspense>
        </AppShell>
      )}
    </RequireAuth>
  );
}

function LessonDetail() {
  const params = useParams();
  const search = useSearchParams();
  const router = useRouter();
  const rawId = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : "";
  const id = decodeURIComponent(rawId || "");
  const lesson = getLesson(id);
  const fromLibrary = search.get("from") === "library";
  const [msg, setMsg] = useState<string | null>(null);
  const [, bump] = useState(0);

  if (!lesson) {
    return (
      <div className="page narrow">
        <Link href="/learn" className="back">
          ← Về lộ trình
        </Link>
        <h1>Không tìm thấy bài</h1>
        <p style={{ color: "var(--muted)" }}>Id: {id || "—"}</p>
      </div>
    );
  }

  const track = lesson.track as TrackId;
  const pathHref = `/learn?track=${track}`;
  const done = isLessonDone(track, lesson.id);
  const inPath = isLessonInPath(track, lesson.id);
  const state = loadLearn();
  const placed = (track === "jp" ? state.jp : state.en).placementDone;

  function refresh() {
    bump((n) => n + 1);
  }

  function goPath() {
    router.push(pathHref);
  }

  function startVocab() {
    const lid = lesson!.id;
    ensureLessonCards(track, lid);
    router.push(
      `/learn/review?track=${track}&lessonId=${encodeURIComponent(lid)}&from=path`,
    );
  }

  return (
    <div className="page narrow">
      <Link
        href={
          fromLibrary
            ? `/learn/lessons?track=${track}&band=${lesson.band}`
            : pathHref
        }
        className="back"
      >
        {fromLibrary ? "← Thư viện bài" : "← Về lộ trình"}
      </Link>
      <p className="eyebrow">
        {lesson.kind} · {lesson.band} · {track.toUpperCase()}
      </p>
      <h1>{lesson.title}</h1>
      <p style={{ color: "var(--muted)", margin: "8px 0 16px" }}>
        {lesson.items.length} mục · ~{lesson.estMinutes} phút
        {done ? " · đã xong" : ""}
        {inPath ? " · trong lộ trình" : ""}
      </p>

      {msg ? <p className="empty-hint">{msg}</p> : null}

      <div className="actions" style={{ marginBottom: 24, flexWrap: "wrap", gap: 8 }}>
        {lesson.kind === "vocab" ? (
          <Button onClick={startVocab}>Học SRS</Button>
        ) : null}
        {lesson.kind === "listening" || lesson.kind === "mock" ? (
          <Link
            href={`/learn/mocks?track=${track}&band=${encodeURIComponent(lesson.band)}&mode=${lesson.kind === "listening" ? "listening" : "vocab"}&from=path`}
          >
            <Button>Làm mock / nghe</Button>
          </Link>
        ) : null}
        {placed && !inPath ? (
          <Button
            variant="secondary"
            onClick={() => {
              const res = addLessonsToPath(track, [lesson.id]);
              setMsg(res.message);
              refresh();
            }}
          >
            Thêm vào lộ trình
          </Button>
        ) : null}
        {done ? (
          <Button onClick={goPath}>Về lộ trình</Button>
        ) : null}
      </div>

      {lesson.kind === "vocab" ? <VocabPreview track={track} lessonId={lesson.id} /> : null}
      {lesson.kind === "grammar" ? (
        <GrammarDrill
          track={track}
          lessonId={lesson.id}
          itemIds={lesson.items.map((i) => i.sourceId)}
          onDone={() => {
            markLessonDone(track, lesson.id);
            router.push(pathHref);
          }}
        />
      ) : null}
      {lesson.kind === "kanji" ? (
        <KanjiDrill
          lessonId={lesson.id}
          itemIds={lesson.items.map((i) => i.sourceId)}
          onDone={() => {
            markLessonDone(track, lesson.id);
            router.push(pathHref);
          }}
        />
      ) : null}
      {(lesson.kind === "mock" || lesson.kind === "listening") && (
        <p className="empty-hint">
          Làm mock xong sẽ quay về lộ trình. Kết quả đạt ngưỡng mới được tính pass.
        </p>
      )}
    </div>
  );
}

function VocabPreview({ track, lessonId }: { track: TrackId; lessonId: string }) {
  const lesson = getLesson(lessonId);
  const ids = lesson ? lessonVocabIds(lesson) : [];
  const state = loadLearn();
  const idx = track === "jp" ? state.jp : state.en;
  // Preview from already-seeded cards; seed happens on "Học SRS"
  const cards = ids
    .map((id) => idx.cards.find((c) => c.sourceId === id))
    .filter(Boolean)
    .slice(0, 12)
    .map((c) => hydrateCard(c!));

  return (
    <div className="catalog-list">
      {cards.length ? (
        cards.map((c) => (
          <article key={c.sourceId} className="catalog-row">
            <div>
              <strong>{c.word}</strong>
              <p>{c.meanings?.[0]}</p>
              {c.reading ? <small>{c.reading}</small> : null}
            </div>
          </article>
        ))
      ) : (
        <p className="empty-hint">{ids.length} từ · bấm “Học SRS” để nạp thẻ và ôn.</p>
      )}
      {cards.length > 0 && ids.length > cards.length ? (
        <p className="empty-hint">+{ids.length - cards.length} từ khác trong bài</p>
      ) : null}
    </div>
  );
}

function GrammarDrill({
  track,
  lessonId,
  itemIds,
  onDone,
}: {
  track: TrackId;
  lessonId: string;
  itemIds: string[];
  onDone: () => void;
}) {
  const bank = useMemo(() => {
    const all = (track === "jp" ? grammarJp : grammarEn) as G[];
    const map = new Map(all.map((g) => [g.id, g]));
    return itemIds.map((id) => map.get(id)).filter(Boolean) as G[];
  }, [track, itemIds]);

  const [i, setI] = useState(0);
  const [selected, setSelected] = useState<number | undefined>();
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);
  const [passed, setPassed] = useState(false);
  const q = bank[i];
  const passNeed = Math.ceil(bank.length * 0.7);

  if (!q && !finished) {
    return <p className="empty-hint">Không có câu grammar trong bài.</p>;
  }

  function next() {
    if (selected === undefined || !q) return;
    const ok = selected === q.answer;
    const nextCorrect = correctCount + (ok ? 1 : 0);
    if (ok) {
      recordGrammarEvidence(track, q.id, true);
      setCorrectCount(nextCorrect);
    }
    recordStudyMinutes(0.4);
    if (i + 1 >= bank.length) {
      const okPass = nextCorrect >= passNeed;
      setPassed(okPass);
      setFinished(true);
      setI(bank.length);
      if (okPass) onDone();
      return;
    }
    setI((n) => n + 1);
    setSelected(undefined);
  }

  if (finished) {
    return (
      <p className="empty-hint">
        {passed
          ? `Đạt ${correctCount}/${bank.length} (≥70%). Bài đã hoàn thành.`
          : `Chưa đạt: ${correctCount}/${bank.length} đúng (cần ≥${passNeed}). Làm lại bài để pass.`}
        {!passed ? (
          <>
            {" "}
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setI(0);
                setSelected(undefined);
                setCorrectCount(0);
                setFinished(false);
                setPassed(false);
              }}
            >
              Làm lại
            </button>
          </>
        ) : null}
      </p>
    );
  }

  return (
    <section className="question">
      <span className="question-label">
        {i + 1}/{bank.length} · {q.pattern}
      </span>
      <p className="jp large">{q.prompt}</p>
      <p className="translation">{displayGrammarMeaning(track, q.id, q.meaning)}</p>
      <div className="choices">
        {q.choices.map((a, idx) => (
          <button
            key={a + idx}
            type="button"
            className={selected === idx ? "selected" : ""}
            onClick={() => setSelected(idx)}
          >
            <span>{String.fromCharCode(65 + idx)}</span>
            {a}
          </button>
        ))}
      </div>
      <div className="question-foot">
        <Button variant={selected === undefined ? "disabled" : "primary"} onClick={next}>
          {i + 1 >= bank.length ? "Xong bài" : "Tiếp"}
        </Button>
      </div>
    </section>
  );
}

function KanjiDrill({
  lessonId,
  itemIds,
  onDone,
}: {
  lessonId: string;
  itemIds: string[];
  onDone: () => void;
}) {
  const chars = itemIds.map((id) => id.replace(/^kanji:/, ""));
  const rows = useMemo(() => {
    const map = new Map(KANJI_ALL.map((k) => [k.character, k]));
    return chars.map((c) => map.get(c)).filter(Boolean) as Kanji[];
  }, [chars]);

  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState(0);
  const [finished, setFinished] = useState(false);
  const [passed, setPassed] = useState(false);
  const k = rows[i];
  const passNeed = Math.ceil(rows.length * 0.7);

  if (!rows.length) return <p className="empty-hint">Không có kanji.</p>;

  function advance(knew: boolean) {
    const nextKnown = known + (knew ? 1 : 0);
    if (knew) {
      recordKanjiEvidence("jp", k.character, true);
      setKnown(nextKnown);
    }
    recordStudyMinutes(0.3);
    setFlipped(false);
    if (i + 1 >= rows.length) {
      const okPass = nextKnown >= passNeed;
      setPassed(okPass);
      setFinished(true);
      setI(rows.length);
      if (okPass) onDone();
    } else setI((n) => n + 1);
  }

  if (finished) {
    return (
      <p className="empty-hint">
        {passed
          ? `Đạt ${known}/${rows.length} biết (≥70%). Bài đã hoàn thành.`
          : `Chưa đạt: ${known}/${rows.length} biết (cần ≥${passNeed}). Làm lại để pass.`}
        {!passed ? (
          <>
            {" "}
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setI(0);
                setFlipped(false);
                setKnown(0);
                setFinished(false);
                setPassed(false);
              }}
            >
              Làm lại
            </button>
          </>
        ) : null}
      </p>
    );
  }

  return (
    <section className="question">
      <span className="question-label">
        {i + 1}/{rows.length} · cần ≥{passNeed} biết
      </span>
      <p className="jp large" style={{ fontSize: 64, textAlign: "center" }}>
        {k.character}
      </p>
      {flipped ? (
        <p className="translation" style={{ textAlign: "center" }}>
          {displayKanjiMeanings(k.level || "N5", k.character, k.meanings).join(", ")}
          <br />
          <small>
            on: {k.onyomi.join(" · ") || "—"} · kun: {k.kunyomi.join(" · ") || "—"}
          </small>
        </p>
      ) : (
        <p className="translation" style={{ textAlign: "center" }}>
          Chạm lật nghĩa
        </p>
      )}
      <div className="actions" style={{ justifyContent: "center", gap: 8 }}>
        {!flipped ? (
          <Button onClick={() => setFlipped(true)}>Lật</Button>
        ) : (
          <>
            <Button onClick={() => advance(true)}>Biết</Button>
            <Button variant="secondary" onClick={() => advance(false)}>
              Chưa chắc
            </Button>
          </>
        )}
      </div>
    </section>
  );
}
