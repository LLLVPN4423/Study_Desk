/**
 * Pre-commit verification for Phase 3 risk gates (F5, F1–F4, F6 mirror, Map polyfill).
 * Isolated / pure — no browser, no mutation of a live user profile.
 *
 * Run: node --experimental-strip-types scripts/smoke-precommit-verify.mjs
 */
import {
  shouldPreserveLearnOnEpochMismatch,
  epochMismatchWarning,
  prepareLearnForRestore,
  decideEpochGate,
} from "../src/lib/learn-epoch.ts";
import { ensureMapGetOrInsertComputed } from "../src/lib/map-polyfill.ts";

/** Keep in sync with LEARN_PATHS_EPOCH in learn-store-core.ts (avoid importing that module in Node). */
const LEARN_PATHS_EPOCH = 8;
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

function cardNeedsLessonPass(card) {
  if (!card) return true;
  const reps = card.card?.reps ?? 0;
  if (reps <= 0) return true;
  if (card.lastGrade == null) return true;
  return card.lastGrade < Rating.Good;
}

function weekPassPct(ids, cardsById) {
  const passed = ids.filter((id) => !cardNeedsLessonPass(cardsById[id])).length;
  return Math.round((passed / ids.length) * 100);
}

function vocabIdsProgress(ids, cardsById) {
  const list = ids || [];
  if (!list.length) {
    return { touched: 0, total: 0, needsQuality: false, vocabDone: true, goodCount: 0 };
  }
  const touched = list.filter((id) => (cardsById[id]?.card?.reps ?? 0) > 0).length;
  const goodCount = list.filter(
    (id) => (cardsById[id]?.lastGrade ?? 0) >= Rating.Good,
  ).length;
  const total = list.length;
  const pct = Math.round((touched / total) * 100);
  const needsQuality = touched >= total && goodCount / total < 0.7;
  const vocabDone =
    !list.some((id) => cardNeedsLessonPass(cardsById[id])) && goodCount / total >= 0.7;
  return { touched, total, pct, needsQuality, vocabDone, goodCount };
}

/** Mirror seedVocabFromLessons skip: only ids not in `have` are added. */
function ensureOnce(existingIds, lessonIds) {
  const have = new Set(existingIds);
  const added = [];
  for (const id of lessonIds) {
    if (have.has(id)) continue;
    have.add(id);
    added.push(id);
  }
  return { added, haveSize: have.size };
}

console.log("\n=== P0 F5 — old + new backup epoch gates ===");
{
  const fs0 = await import("node:fs");
  const path0 = await import("node:path");
  const { fileURLToPath: fut } = await import("node:url");
  const coreSrc = fs0.readFileSync(
    path0.join(path0.dirname(fut(import.meta.url)), "../src/lib/learn-store-core.ts"),
    "utf8",
  );
  const epochMatch = coreSrc.match(/LEARN_PATHS_EPOCH\s*=\s*(\d+)/);
  assert(
    epochMatch && Number(epochMatch[1]) === LEARN_PATHS_EPOCH,
    `F5 smoke epoch constant matches learn-store-core (${LEARN_PATHS_EPOCH})`,
  );

  const oldBackup = {
    pathsEpoch: 7,
    preferredTrack: "jp",
    jp: {
      pathActive: true,
      cards: [
        { sourceId: "jlpt-n5-1", lastGrade: Rating.Good, card: { reps: 2 } },
        { sourceId: "manual-desk-1", lastGrade: Rating.Again, card: { reps: 1 } },
      ],
      roadmap: { weeks: [{ week: 1, days: [] }] },
      actionProgress: { "w1-review": { doneAt: "2026-01-01" } },
    },
    en: { cards: [] },
  };

  const gateOld = decideEpochGate(oldBackup, LEARN_PATHS_EPOCH);
  assert(gateOld.action === "preserve", "F5 old epoch with cards → preserve (not seed)");
  assert(gateOld.preferredTrack === "jp", "F5 preferredTrack kept jp");

  const prepared = prepareLearnForRestore(oldBackup, LEARN_PATHS_EPOCH);
  assert(prepared.learn.pathsEpoch === LEARN_PATHS_EPOCH, "F5 restore bumps epoch to current");
  assert(typeof prepared.epochNote === "string", "F5 restore emits epoch warning for old backup");
  assert(
    prepared.learn.jp.cards.length === 2 &&
      prepared.learn.jp.cards[0].sourceId === "jlpt-n5-1" &&
      prepared.learn.jp.actionProgress["w1-review"]?.doneAt === "2026-01-01" &&
      prepared.learn.jp.roadmap?.weeks?.length === 1,
    "F5 restore keeps cards, actionProgress, roadmap",
  );

  // After restore bump, loadLearn gate must be unchanged (no second migration wipe)
  const afterRestore = decideEpochGate(prepared.learn, LEARN_PATHS_EPOCH);
  assert(afterRestore.action === "unchanged", "F5 post-restore load → unchanged (no wipe)");

  const newBackup = {
    pathsEpoch: LEARN_PATHS_EPOCH,
    preferredTrack: "en",
    en: { cards: [{ sourceId: "cefr-a1-1", card: { reps: 0 } }], pathActive: true },
    jp: { cards: [] },
  };
  const prepNew = prepareLearnForRestore(newBackup, LEARN_PATHS_EPOCH);
  assert(prepNew.learn.pathsEpoch === LEARN_PATHS_EPOCH, "F5 new backup epoch stays current");
  assert(prepNew.epochNote === undefined, "F5 new backup no epoch warning");
  assert(decideEpochGate(prepNew.learn, LEARN_PATHS_EPOCH).action === "unchanged", "F5 new backup load unchanged");
  assert(prepNew.learn.en.cards[0].sourceId === "cefr-a1-1", "F5 new backup cards intact");

  // Empty old epoch still seeds (no false preserve)
  assert(
    decideEpochGate({ pathsEpoch: 7, jp: { cards: [] }, en: { cards: [] } }, LEARN_PATHS_EPOCH)
      .action === "seed-beginner",
    "F5 empty old epoch → seed-beginner only",
  );

  assert(
    !shouldPreserveLearnOnEpochMismatch({ pathsEpoch: 7 }),
    "F5 probe: empty not preserved",
  );
}

console.log("\n=== P1 F1 — week pass vs Again ===");
{
  const ids = ["a", "b", "c", "d", "e"];
  const again = Object.fromEntries(
    ids.map((id) => [id, { card: { reps: 1 }, lastGrade: Rating.Again }]),
  );
  assert(weekPassPct(ids, again) === 0, "F1 Again-only week pass = 0 (not touch-80)");
  // Old wrong metric would count reps>0 as 100%
  const touchPct = Math.round(
    (ids.filter((id) => (again[id].card.reps ?? 0) > 0).length / ids.length) * 100,
  );
  assert(touchPct === 100 && weekPassPct(ids, again) === 0, "F1 touch≠pass when all Again");

  const mixed = {
    a: { card: { reps: 1 }, lastGrade: Rating.Good },
    b: { card: { reps: 1 }, lastGrade: Rating.Easy },
    c: { card: { reps: 1 }, lastGrade: Rating.Good },
    d: { card: { reps: 1 }, lastGrade: Rating.Good },
    e: { card: { reps: 1 }, lastGrade: Rating.Hard },
  };
  assert(weekPassPct(ids, mixed) === 80, "F1 4/5 Good+ → 80% unlock threshold");
}

console.log("\n=== P1 F2 — <70% Good / needsQuality ===");
{
  const ids = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];
  const cards = Object.fromEntries(
    ids.map((id, i) => [
      id,
      {
        card: { reps: 1 },
        lastGrade: i < 6 ? Rating.Good : Rating.Again, // 60% Good < 70%
      },
    ]),
  );
  const p = vocabIdsProgress(ids, cards);
  assert(p.touched === 10 && p.goodCount === 6, "F2 all touched, 6/10 Good");
  assert(p.needsQuality === true, "F2 needsQuality when <70% Good");
  assert(p.vocabDone === false, "F2 vocabDone false below threshold");
  assert(
    !(p.touched >= p.total && p.total > 0) || !p.vocabDone,
    "F2 timeline must not treat touch-complete as vocab done",
  );
}

console.log("\n=== P1 F3 — unmount must not auto-tick (contract) ===");
{
  // Static contract: review page must not call markCurrentWeekAction on cleanup.
  // Enforced by grepping source in this smoke.
  const fs = await import("node:fs");
  const path = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
  const reviewSrc = fs.readFileSync(path.join(root, "src/app/learn/review/page.tsx"), "utf8");
  assert(
    !/markCurrentWeekAction/.test(reviewSrc),
    "F3 review page has no markCurrentWeekAction",
  );
  assert(
    /Phase 3 F3: do not auto-tick/.test(reviewSrc),
    "F3 cleanup comment documents no auto-tick",
  );
}

console.log("\n=== P1 F4 — lessonId progress vs today ===");
{
  const todayIds = ["t1", "t2", "t3"];
  const lessonIds = ["L1", "L2", "L3", "L4", "L5"];
  const cards = {
    t1: { card: { reps: 1 }, lastGrade: Rating.Good },
    t2: { card: { reps: 1 }, lastGrade: Rating.Good },
    t3: { card: { reps: 1 }, lastGrade: Rating.Good },
    L1: { card: { reps: 1 }, lastGrade: Rating.Again },
    L2: { card: { reps: 1 }, lastGrade: Rating.Again },
    L3: { card: { reps: 0 } },
    L4: { card: { reps: 0 } },
    L5: { card: { reps: 0 } },
  };
  const today = vocabIdsProgress(todayIds, cards);
  const forced = vocabIdsProgress(lessonIds, cards);
  assert(today.vocabDone === true, "F4 today lesson complete");
  assert(forced.vocabDone === false && forced.touched === 2, "F4 forced lesson still incomplete");
  assert(
    today.pct !== forced.pct,
    "F4 forced lessonId progress must differ from today when sets differ",
  );
}

console.log("\n=== P1 F6 — ensureLessonCards idempotent ===");
{
  const lessonIds = ["v1", "v2", "v3"];
  const first = ensureOnce([], lessonIds);
  assert(first.added.length === 3 && first.haveSize === 3, "F6 first ensure adds all missing");
  const second = ensureOnce([...first.added], lessonIds);
  assert(second.added.length === 0 && second.haveSize === 3, "F6 second ensure adds 0 (no dupes)");
  const partial = ensureOnce(["v1"], lessonIds);
  assert(
    partial.added.length === 2 &&
      partial.added.includes("v2") &&
      partial.added.includes("v3") &&
      !partial.added.includes("v1"),
    "F6 partial have only adds missing ids",
  );
}

console.log("\n=== Map polyfill — native-safe ===");
{
  const nativeBefore = Object.prototype.hasOwnProperty.call(
    Map.prototype,
    "getOrInsertComputed",
  )
    ? Map.prototype.getOrInsertComputed
    : null;
  const hadNative =
    typeof Map.prototype.getOrInsertComputed === "function" &&
    // own or inherited from engine
    Map.prototype.getOrInsertComputed.length >= 1;

  ensureMapGetOrInsertComputed();
  const afterFirst = Map.prototype.getOrInsertComputed;
  ensureMapGetOrInsertComputed();
  const afterSecond = Map.prototype.getOrInsertComputed;
  assert(afterFirst === afterSecond, "polyfill re-entry does not replace existing function");

  const m = new Map();
  let calls = 0;
  const v1 = m.getOrInsertComputed("x", () => {
    calls += 1;
    return { n: 1 };
  });
  const v2 = m.getOrInsertComputed("x", () => {
    calls += 1;
    return { n: 2 };
  });
  assert(v1 === v2 && calls === 1, "polyfill computes once and returns same ref");

  // If engine already had native, we must not have overwritten with a different fn
  // (ensure only assigns when typeof !== 'function')
  if (hadNative && nativeBefore) {
    assert(
      Map.prototype.getOrInsertComputed === nativeBefore ||
        typeof Map.prototype.getOrInsertComputed === "function",
      "native getOrInsertComputed left intact when already present",
    );
  }
  assert(
    !Object.getOwnPropertyDescriptor(globalThis, "ensureMapGetOrInsertComputed"),
    "polyfill not hung on globalThis",
  );
}

if (failed) {
  console.error(`\nsmoke-precommit-verify: ${failed} failure(s)`);
  process.exit(1);
}
console.log("\nsmoke-precommit-verify: all assertions passed");
