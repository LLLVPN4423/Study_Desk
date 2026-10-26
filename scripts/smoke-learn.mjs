/**
 * Headless smoke for learn curriculum (no browser / Next).
 * Validates data banks + pure helpers mirrored from app logic where possible.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const data = (name) =>
  JSON.parse(fs.readFileSync(path.join(root, "src", "data", name), "utf8"));

const fails = [];
function check(name, fn) {
  try {
    fn();
    console.log("PASS", name);
  } catch (e) {
    fails.push({ name, err: e.message || String(e) });
    console.log("FAIL", name, "—", e.message || e);
  }
}

const jpLevels = ["N5", "N4", "N3", "N2", "N1"];
const enLevels = ["A1", "A2", "B1", "B2", "C1", "C2"];

check("JP vocab files exist per level", () => {
  for (const lv of jpLevels) {
    const rows = data(`openjlpt-${lv.toLowerCase()}-seed.json`);
    assert.ok(Array.isArray(rows) && rows.length > 50, `${lv} too small`);
    assert.ok(rows.every((w) => w.level === lv), `${lv} mixed levels`);
  }
});

check("JP kanji files exist N5–N1", () => {
  for (const lv of jpLevels) {
    const rows = data(`openjlpt-kanji-${lv.toLowerCase()}.json`);
    assert.ok(Array.isArray(rows) && rows.length > 20, `${lv} kanji`);
  }
});

check("JP grammar covers N5–N1", () => {
  const g = data("grammar-jp.json");
  for (const lv of jpLevels) {
    assert.ok(g.some((x) => x.level === lv), `missing grammar ${lv}`);
  }
});

check("EN vocab A1–C2 present", () => {
  const rows = data("cefrj-vocab-seed.json");
  assert.ok(rows.length > 5000, "EN vocab size");
  for (const lv of enLevels) {
    const n = rows.filter((w) => w.level === lv).length;
    assert.ok(n > 100, `${lv} count ${n}`);
  }
});

check("EN grammar A1–C2", () => {
  const g = data("grammar-en.json");
  assert.ok(g.length >= 174, `grammar-en ${g.length}`);
  for (const lv of enLevels) {
    assert.ok(g.some((x) => x.level === lv), `missing EN grammar ${lv}`);
  }
});

check("placement JP has N1 + listening", () => {
  const p = data("placement-jp.json");
  assert.ok(p.filter((q) => q.bandHint === "N1").length >= 6);
  assert.ok(p.filter((q) => q.speak).length >= 3);
});

check("placement EN has C2 + listening", () => {
  const p = data("placement-en.json");
  assert.ok(p.filter((q) => q.bandHint === "C2").length >= 5);
  assert.ok(p.filter((q) => q.speak).length >= 3);
});

check("mocks-by-band packs for all bands", () => {
  const { packs } = data("mocks-by-band.json");
  assert.equal(packs.length, 22);
  for (const lv of jpLevels) {
    assert.ok(packs.some((p) => p.track === "jp" && p.band === lv && p.mode === "vocab"));
    assert.ok(packs.some((p) => p.track === "jp" && p.band === lv && p.mode === "listening"));
  }
  for (const lv of enLevels) {
    assert.ok(packs.some((p) => p.track === "en" && p.band === lv && p.mode === "vocab"));
    assert.ok(packs.some((p) => p.track === "en" && p.band === lv && p.mode === "listening"));
  }
  for (const p of packs) {
    assert.ok(p.questions?.length >= 5, p.id);
  }
});

check("learn feature modules exist", () => {
  for (const rel of [
    "src/lib/learn-store.ts",
    "src/lib/roadmap.ts",
    "src/lib/placement.ts",
    "src/lib/mocks-band.ts",
    "src/lib/path-evidence.ts",
    "src/app/learn/page.tsx",
    "src/app/learn/placement/page.tsx",
    "src/app/learn/mocks/page.tsx",
    "src/app/help/page.tsx",
  ]) {
    assert.ok(fs.existsSync(path.join(root, rel)), rel);
  }
});

check("source mentions promote / cover / mastery / studyQueue", () => {
  const store = fs.readFileSync(path.join(root, "src/lib/learn-store.ts"), "utf8");
  assert.match(store, /promoteBand/);
  assert.match(store, /appendFullPrimaryVocab/);
  assert.match(store, /getLevelCover/);
  assert.match(store, /getLevelMastery/);
  assert.match(store, /getPathPace/);
  assert.match(store, /studyQueue/);
  assert.match(store, /hydrateCard/);
  assert.match(store, /canPromoteBand/);
  assert.match(store, /PROMOTE_MASTERY_MIN/);
  assert.match(store, /PROMOTE_STABLE_MIN/);
  const road = fs.readFileSync(path.join(root, "src/lib/roadmap.ts"), "utf8");
  assert.match(road, /levelCoverStats/);
  assert.match(road, /primaryLevelPool/);
  assert.match(road, /estimatePathSchedule/);
  assert.match(road, /etaWeeks/);
  assert.match(road, /RoadmapDay|buildVocabWeekDays/);
  assert.match(road, /ROADMAP_PLAN_VERSION/);
  assert.match(road, /vocabSourceIds/);
  assert.match(store, /getTodayPlan/);
  assert.match(store, /getDailyStudyProgress/);
  assert.match(store, /newCardsToday/);
  assert.match(store, /queueKind/);
  assert.match(store, /LEARN_PATHS_EPOCH/);
  assert.match(store, /weekVocabMastery/);
  assert.match(store, /dayVocabProgress/);
  assert.match(store, /weekProgressRaw/);
  assert.match(store, /savePlacement/);
  assert.match(store, /extendPath/);
  assert.match(store, /pathBuildStats/);
  assert.match(store, /addLessonsToPath/);
  assert.match(store, /addSuggestedPath/);
  assert.match(road, /buildChapterWeek/);
  assert.match(road, /buildWeeksFromLessons/);
  assert.match(road, /lessonId/);
  assert.match(road, /ROADMAP_PLAN_VERSION\s*=\s*7/);
  const lessons = fs.readFileSync(path.join(root, "src/lib/lessons.ts"), "utf8");
  assert.match(lessons, /suggestLessons/);
  assert.match(lessons, /listLessons/);
  assert.match(lessons, /LessonKind/);
  assert.ok(fs.existsSync(path.join(root, "src/app/learn/lessons/page.tsx")));
  assert.ok(fs.existsSync(path.join(root, "src/app/learn/lessons/[id]/page.tsx")));
  assert.match(road, /Bài \$\{day\}/);
  const free = fs.readFileSync(path.join(root, "src/lib/freemium.ts"), "utf8");
  assert.match(free, /FREEMIUM_ENABLED\s*=\s*false/);
  assert.match(store, /freemiumUnlocked/);
  const goals = fs.readFileSync(path.join(root, "src/lib/path-goals.ts"), "utf8");
  assert.match(goals, /newCardsPerDay/);
  assert.match(goals, /estimatePathSchedule/);
});

check("ETA math helpers in path-goals source", () => {
  const src = fs.readFileSync(path.join(root, "src/lib/path-goals.ts"), "utf8");
  assert.match(src, /light.*15|return 15/);
  assert.match(src, /intense.*40|return 40/);
  assert.match(src, /1\.25/);
});

check("primary pool sizes sane in data", () => {
  const n5 = data("openjlpt-n5-seed.json");
  assert.ok(n5.length > 400, `N5 pool ${n5.length}`);
  const a2 = data("cefrj-vocab-seed.json").filter((w) => w.level === "A2");
  assert.ok(a2.length > 200, `A2 pool ${a2.length}`);
});

console.log("\n---");
console.log(fails.length ? `SMOKE FAILED: ${fails.length}` : "SMOKE OK");
process.exit(fails.length ? 1 : 0);
