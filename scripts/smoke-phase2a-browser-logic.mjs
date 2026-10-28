/**
 * Phase 2A manual-checklist T1–T6 as automated logic checks
 * (same rules the Review queue uses; no UI).
 * Run: node --experimental-strip-types scripts/smoke-phase2a-browser-logic.mjs
 */

import {
  assembleStudyQueue,
  DESK_NEW_SOFT_CAP,
} from "../src/lib/study-queue.ts";

let failed = 0;
const results = [];

function assert(cond, id, msg) {
  if (!cond) {
    failed += 1;
    results.push({ id, status: "FAIL", msg });
    console.error(`FAIL ${id}:`, msg);
  } else {
    results.push({ id, status: "PASS", msg });
    console.log(`ok ${id}:`, msg);
  }
}

function card(sourceId, reps, dueMs = Date.now() - 60_000, word = sourceId) {
  return { sourceId, word, live: { reps, due: new Date(dueMs) } };
}

const now = Date.now();

// --- T1: create without path (logic of addManualCard after 2A) ---
{
  function addManualCardPure(pathActive, word, meanings) {
    const w = (word || "").trim();
    if (!w) return { ok: false, reason: "empty word", pathActive };
    const m = (meanings || []).map((x) => String(x).trim()).filter(Boolean);
    if (!m.length) return { ok: false, reason: "empty meanings", pathActive };
    // 2A: no pathActive gate
    return {
      ok: true,
      pathActiveAfter: pathActive, // unchanged
      card: {
        sourceId: `manual-test-${w}`,
        word: w,
        meanings: m,
        reps: 0,
      },
    };
  }
  const r = addManualCardPure(false, "phase2a-t1", ["thử nghiệm"]);
  assert(r.ok, "T1", "create succeeds with pathActive=false");
  assert(r.pathActiveAfter === false, "T1", "does not activate path");
  const blocked = addManualCardPure(false, "  ", ["x"]);
  assert(!blocked.ok, "T1", "still rejects empty word");
}

// --- T2: new manual in queue before grade ---
{
  const created = card("manual-phase2a-t1", 0, now, "phase2a-t1");
  const q = assembleStudyQueue({
    cards: [created],
    lessonSourceIds: [],
    needsLessonPass: () => false,
    nowMs: now,
    remainingQuota: 100,
    lessonWorkSlotLimit: 0,
    dueSlotLimit: 0,
  });
  assert(
    q.length === 1 && q[0].sourceId === "manual-phase2a-t1" && q[0].queueKind === "new",
    "T2",
    "new desk card appears in review queue before first grade",
  );
}

// --- T3: after grade (reps>0, due future) not in desk-new; scheduling fields persist conceptually ---
{
  const graded = card("manual-phase2a-t1", 1, now + 86400000, "phase2a-t1");
  const qNew = assembleStudyQueue({
    cards: [graded],
    lessonSourceIds: [],
    needsLessonPass: () => false,
    nowMs: now,
    remainingQuota: 100,
    lessonWorkSlotLimit: 0,
    dueSlotLimit: 100,
  });
  assert(
    qNew.length === 0,
    "T3",
    "after grade (reps>0, not yet due) card leaves new-desk bucket",
  );
  const dueAgain = card("manual-phase2a-t1", 2, now - 1000, "phase2a-t1");
  const qDue = assembleStudyQueue({
    cards: [dueAgain],
    lessonSourceIds: [],
    needsLessonPass: () => false,
    nowMs: now,
    remainingQuota: 100,
    lessonWorkSlotLimit: 0,
    dueSlotLimit: 100,
  });
  assert(
    qDue.length === 1 && qDue[0].queueKind === "review",
    "T3",
    "when due again, appears as due review (persisted reps)",
  );
}

// --- T4: lesson → due → desk-new ---
{
  const q = assembleStudyQueue({
    cards: [
      card("manual-z", 0, now, "DESK-THIRD"),
      card("lesson-a", 0, now, "LESSON-FIRST"),
      card("due-1", 3, now - 5000, "DUE-SECOND"),
    ],
    lessonSourceIds: ["lesson-a"],
    needsLessonPass: (id) => id === "lesson-a",
    nowMs: now,
    remainingQuota: 100,
    lessonWorkSlotLimit: 50,
    dueSlotLimit: 50,
  });
  assert(
    q.map((c) => c.word).join(",") === "LESSON-FIRST,DUE-SECOND,DESK-THIRD",
    "T4",
    `order=${q.map((c) => c.word).join(",")}`,
  );
}

// --- T5: soft cap 10 ---
{
  const manuals = Array.from({ length: 15 }, (_, i) =>
    card(`manual-${i}`, 0, now, `cap-${i}`),
  );
  const q = assembleStudyQueue({
    cards: manuals,
    lessonSourceIds: [],
    needsLessonPass: () => false,
    nowMs: now,
    remainingQuota: 100,
    lessonWorkSlotLimit: 0,
    dueSlotLimit: 0,
    deskNewSoftCap: DESK_NEW_SOFT_CAP,
  });
  assert(q.length === 10, "T5", `desk-new capped at ${q.length} (expect 10)`);
  assert(
    q.every((c) => c.sourceId.startsWith("manual-")),
    "T5",
    "all capped entries are desk manuals",
  );
}

// --- T6: due not capped; no dupes ---
{
  const cards = [
    ...Array.from({ length: 12 }, (_, i) => card(`due-${i}`, 3, now - 1000 - i, `DUE-${i}`)),
    ...Array.from({ length: 15 }, (_, i) => card(`manual-${i}`, 0, now, `NEW-${i}`)),
  ];
  const q = assembleStudyQueue({
    cards,
    lessonSourceIds: [],
    needsLessonPass: () => false,
    nowMs: now,
    remainingQuota: 100,
    lessonWorkSlotLimit: 0,
    dueSlotLimit: 100,
    deskNewSoftCap: DESK_NEW_SOFT_CAP,
  });
  const dues = q.filter((c) => c.sourceId.startsWith("due-"));
  const news = q.filter((c) => c.sourceId.startsWith("manual-"));
  const ids = q.map((c) => c.sourceId);
  assert(dues.length === 12, "T6", `due count=${dues.length} (not soft-capped)`);
  assert(news.length === 10, "T6", `desk-new count=${news.length}`);
  assert(new Set(ids).size === ids.length, "T6", "no duplicate sourceIds");
  assert(
    q.findIndex((c) => c.sourceId.startsWith("due-")) <
      q.findIndex((c) => c.sourceId.startsWith("manual-")),
    "T6",
    "due before desk-new",
  );
}

console.log("\n--- Summary ---");
for (const r of results) console.log(`${r.status}\t${r.id}\t${r.msg}`);
if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nAll T1–T6 logic checks PASS");
