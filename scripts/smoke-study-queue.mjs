/**
 * Slice 2A — study queue eligibility smoke (pure assembleStudyQueue).
 * Run: npm run smoke:study-queue
 *
 * Note: addManualCard / localStorage paths are covered by tsc + manual P2-I1/I2;
 * Node ESM cannot resolve extensionless imports inside learn-store-core.ts.
 */

import {
  assembleStudyQueue,
  DESK_NEW_SOFT_CAP,
  isManualDeskCardId,
} from "../src/lib/study-queue.ts";

let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL:", msg);
  } else {
    console.log("ok:", msg);
  }
}

function card(sourceId, reps, dueMs = Date.now() - 60_000) {
  return { sourceId, live: { reps, due: new Date(dueMs) }, word: sourceId };
}

const now = Date.now();

assert(isManualDeskCardId("manual-abc"), "manual id detected");
assert(!isManualDeskCardId("jp-n5-1"), "curriculum id not manual");
assert(DESK_NEW_SOFT_CAP === 10, "DESK_NEW_SOFT_CAP default is 10");

// P2-U1
{
  const q = assembleStudyQueue({
    cards: [card("manual-new-1", 0)],
    lessonSourceIds: [],
    needsLessonPass: () => false,
    nowMs: now,
    remainingQuota: 100,
    lessonWorkSlotLimit: 0,
    dueSlotLimit: 0,
    deskNewSoftCap: DESK_NEW_SOFT_CAP,
  });
  assert(
    q.length === 1 && q[0].sourceId === "manual-new-1" && q[0].queueKind === "new",
    "P2-U1 new manual appears without prior grade",
  );
}

// P2-U2
{
  const q = assembleStudyQueue({
    cards: [card("manual-z", 0), card("lesson-a", 0), card("manual-y", 0)],
    lessonSourceIds: ["lesson-a"],
    needsLessonPass: (id) => id === "lesson-a",
    nowMs: now,
    remainingQuota: 100,
    lessonWorkSlotLimit: 50,
    dueSlotLimit: 50,
    deskNewSoftCap: DESK_NEW_SOFT_CAP,
  });
  assert(q[0]?.sourceId === "lesson-a", "P2-U2 lesson work first");
  assert(
    q.slice(1).every((c) => c.sourceId.startsWith("manual-")),
    "P2-U2 desk-new after lesson",
  );
}

// P2-U3
{
  const dueIds = Array.from({ length: 12 }, (_, i) => `due-${i}`);
  const manuals = Array.from({ length: 5 }, (_, i) => `manual-n${i}`);
  const cards = [
    ...manuals.map((id) => card(id, 0)),
    ...dueIds.map((id, i) => card(id, 3, now - 1000 - i)),
  ];
  const q = assembleStudyQueue({
    cards,
    lessonSourceIds: [],
    needsLessonPass: () => false,
    nowMs: now,
    remainingQuota: 100,
    lessonWorkSlotLimit: 0,
    dueSlotLimit: 100,
    deskNewSoftCap: 3,
  });
  const duePart = q.filter((c) => c.sourceId.startsWith("due-"));
  const deskPart = q.filter((c) => c.sourceId.startsWith("manual-"));
  assert(duePart.length === 12, "P2-U3 all due cards included (not desk-capped)");
  assert(
    q.findIndex((c) => c.sourceId.startsWith("due-")) <
      q.findIndex((c) => c.sourceId.startsWith("manual-")),
    "P2-U3 due before desk-new",
  );
  assert(deskPart.length === 3, "P2-U3 desk soft cap applies only to desk-new");
}

// P2-U4
{
  const manuals = Array.from({ length: 15 }, (_, i) =>
    card(`manual-${String(i).padStart(2, "0")}`, 0),
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
  assert(q.length === DESK_NEW_SOFT_CAP, "P2-U4 soft cap truncates desk-new");
  assert(
    q.map((c) => c.sourceId).join(",") ===
      manuals
        .slice(0, DESK_NEW_SOFT_CAP)
        .map((c) => c.sourceId)
        .join(","),
    "P2-U4 desk-new order matches card array order",
  );
}

// P2-U5
{
  const q = assembleStudyQueue({
    cards: [card("manual-dup", 0)],
    lessonSourceIds: ["manual-dup"],
    needsLessonPass: () => true,
    nowMs: now,
    remainingQuota: 100,
    lessonWorkSlotLimit: 10,
    dueSlotLimit: 10,
    deskNewSoftCap: DESK_NEW_SOFT_CAP,
  });
  assert(q.length === 1, "P2-U5 single entry when lesson+manual");
  assert(q[0].sourceId === "manual-dup", "P2-U5 id preserved once");
}

{
  const q = assembleStudyQueue({
    cards: [card("seed-x", 0), card("manual-ok", 0)],
    lessonSourceIds: [],
    needsLessonPass: () => false,
    nowMs: now,
    remainingQuota: 100,
    lessonWorkSlotLimit: 0,
    dueSlotLimit: 0,
  });
  assert(
    q.length === 1 && q[0].sourceId === "manual-ok",
    "non-manual new cards outside lesson stay out",
  );
}

{
  const q = assembleStudyQueue({
    cards: [card("lesson-a", 0), card("due-1", 2), card("manual-x", 0)],
    lessonSourceIds: ["lesson-a"],
    needsLessonPass: () => true,
    nowMs: now,
    remainingQuota: 2,
    lessonWorkSlotLimit: 2,
    dueSlotLimit: 2,
    deskNewSoftCap: 10,
  });
  assert(
    q.map((c) => c.sourceId).join(",") === "lesson-a,due-1",
    "desk-new does not starve lesson/due under quota",
  );
}

if (failed) {
  console.error(`\n${failed} smoke-study-queue assertion(s) failed`);
  process.exit(1);
}
console.log("\nsmoke-study-queue: all assertions passed");
