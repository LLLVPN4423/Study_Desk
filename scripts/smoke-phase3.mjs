/**
 * Phase 3 progress / epoch pure helpers (no browser).
 * Run: npm run smoke:phase3
 */
import {
  shouldPreserveLearnOnEpochMismatch,
  epochMismatchWarning,
} from "../src/lib/learn-epoch.ts";
import { ensureMapGetOrInsertComputed } from "../src/lib/map-polyfill.ts";

/** Mirror ts-fsrs Rating without importing fsrs.ts (Node ESM Card type issue). */
const Rating = { Again: 1, Hard: 2, Good: 3, Easy: 4 };

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL:", msg);
  } else {
    console.log("ok:", msg);
  }
}

// --- Epoch preserve (F5) ---
{
  assert(
    !shouldPreserveLearnOnEpochMismatch({ pathsEpoch: 7 }),
    "empty learn not preserved",
  );
  assert(
    shouldPreserveLearnOnEpochMismatch({
      pathsEpoch: 7,
      jp: { cards: [{ sourceId: "x" }] },
    }),
    "cards preserved across epoch",
  );
  assert(
    shouldPreserveLearnOnEpochMismatch({
      pathsEpoch: 7,
      jp: { pathActive: true, cards: [] },
    }),
    "pathActive preserved",
  );
  assert(
    shouldPreserveLearnOnEpochMismatch({
      en: { roadmap: { weeks: [] }, cards: [] },
    }),
    "roadmap preserved",
  );
  const warn = epochMismatchWarning(7, 8);
  assert(typeof warn === "string" && warn.includes("7") && warn.includes("8"), "epoch warning text");
  assert(epochMismatchWarning(8, 8) === undefined, "matching epoch no warning");
}

// --- Lesson pass semantics mirror (F1) ---
{
  function cardNeedsLessonPass(card) {
    if (!card) return true;
    const reps = card.card?.reps ?? 0;
    if (reps <= 0) return true;
    if (card.lastGrade == null) return true;
    return card.lastGrade < Rating.Good;
  }
  function weekPassPct(ids, cardsById) {
    const touched = ids.filter((id) => !cardNeedsLessonPass(cardsById[id])).length;
    return Math.round((touched / ids.length) * 100);
  }
  const ids = ["a", "b", "c", "d", "e"];
  const againOnly = Object.fromEntries(
    ids.map((id) => [id, { card: { reps: 1 }, lastGrade: Rating.Again }]),
  );
  assert(weekPassPct(ids, againOnly) === 0, "Again-only week pass pct is 0");
  const goodMost = {
    a: { card: { reps: 1 }, lastGrade: Rating.Good },
    b: { card: { reps: 1 }, lastGrade: Rating.Easy },
    c: { card: { reps: 1 }, lastGrade: Rating.Good },
    d: { card: { reps: 1 }, lastGrade: Rating.Good },
    e: { card: { reps: 1 }, lastGrade: Rating.Hard },
  };
  assert(weekPassPct(ids, goodMost) === 80, "4/5 Good+ → 80% week pass");
}

// --- Timeline vocabDone (F2) ---
{
  function timelineVocabDone(dp, hasVocabIds) {
    if (!hasVocabIds) return true;
    return Boolean(dp.vocabDone);
  }
  assert(
    !timelineVocabDone({ touched: 5, total: 5, needsQuality: true, vocabDone: false }, true),
    "touched-all but needsQuality → not vocab done",
  );
  assert(
    timelineVocabDone({ touched: 5, total: 5, needsQuality: false, vocabDone: true }, true),
    "quality cleared → vocab done",
  );
}

// --- Map polyfill (Inkbar) ---
{
  const had = typeof Map.prototype.getOrInsertComputed === "function";
  ensureMapGetOrInsertComputed();
  assert(typeof Map.prototype.getOrInsertComputed === "function", "getOrInsertComputed available");
  const m = new Map();
  const v = m.getOrInsertComputed("k", () => 42);
  assert(v === 42 && m.get("k") === 42, "polyfill inserts once");
  assert(m.getOrInsertComputed("k", () => 99) === 42, "polyfill does not recompute");
  if (!had) {
    // leave polyfill in place for process; fine in smoke
  }
}

if (failed) {
  console.error(`smoke-phase3: ${failed} failure(s)`);
  process.exit(1);
}
console.log("smoke-phase3: all assertions passed");
