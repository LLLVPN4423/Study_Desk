# Study Desk — Phase 3 Audit

**Date:** 2026-10-29  
**Method:** Code inspection of Learn/FSRS/progress paths + prior Phase 2 browser evidence.  
**Rule:** Defects listed only with concrete evidence.

---

## Existing behavior (canonical paths)

| Concern | Source of truth | Entry points |
|---------|-----------------|--------------|
| Grade → schedule | `rateCard` → `schedule` (ts-fsrs) → `card` + `lastGrade` | `learn/review/page.tsx` |
| Review queue | `studyQueue` → `assembleStudyQueue` | lesson work → due → desk-new (`DESK_NEW_SOFT_CAP`) |
| Day pass (vocab) | `dayVocabDone` / `cardNeedsLessonPass` + ≥70% Good/Easy | `isDayComplete`, `dayVocabProgress` |
| Week % / unlock | `weekVocabMastery` (touch/`reps>0`) → `weekProgressRaw` ≥80% | `pathWeekIndex`, `getTodayPlan` |
| Level mastery | `getLevelMastery`: touched % + stable (`scheduled_days≥3`) | Learn hub, promote |
| Next action (UI) | `getTodayPlan` + `PathTimeline` | Learn / Roadmap |
| Backup learn | `restoreBackupAsync` → `saveLearn` | Settings; then `loadLearn` on next Learn open |

FSRS grade persistence and lesson Again/Hard requeue are **sound** (no P0 found in schedule-on-grade itself).

---

## Confirmed findings

### F5 — Cross-epoch restore then silent wipe — **P0**

- **Evidence:** `loadLearn` wipes to `seedBeginnerZeroPaths` when `pathsEpoch !== LEARN_PATHS_EPOCH` (currently `8`). Restore writes payload as-is; next Learn open destroys cards/progress.
- **Repro:** Restore backup with `pathsEpoch: 7` or missing → Settings success → open Learn → beginner reseed; prior cards gone.
- **Plan:** If restored/parsed state has cards, roadmap, or `pathActive`, **migrate in place** (bump epoch only). Seed beginner only when there is no meaningful learn data. Warn on restore when epoch differs.
- **Tests:** pure epoch-preserve helper + smoke.

### F1 — Week index uses touch %, day pass uses quality — **P1**

- **Evidence:** `weekVocabMastery` counts `reps>0`; `dayVocabDone` requires lastGrade ≥ Good and ≥70% ratio. `pathWeekIndex` advances on week touch ≥80%.
- **Repro:** Grade ≥80% of week-1 vocab Again/Hard only → week index can advance while days still fail quality.
- **Plan:** Count week mastery as ids that **do not** `cardNeedsLessonPass` (aligned with lesson quality).
- **Tests:** Again-only week stays &lt;80% pass; Good grades advance.

### F2 — PathTimeline “Từ xong” ignores quality — **P1**

- **Evidence:** `PathTimeline.tsx` uses `dp.touched >= dp.total` and ignores `dp.needsQuality`.
- **Plan:** Vocab done iff no vocab ids **or** (`touched >= total` and not `needsQuality`).
- **Tests:** smoke helper / documented checklist.

### F3 — Unmount after 3 grades auto-ticks week review/vocab — **P1**

- **Evidence:** `review/page.tsx` cleanup calls `markCurrentWeekAction(track, ["review","vocab"])` when `sessionRatedRef >= 3` with no mastery gate.
- **Plan:** Remove unmount auto-tick; rely on `syncPathFromActivity` / explicit gates.
- **Tests:** checklist + code absence; optional smoke on mark gating.

### F4 — `lessonId` review UI tracks Today’s day — **P1**

- **Evidence:** Queue uses `lessonId` vocab; `setLessonPct` uses `getTodayPlan().day`.
- **Plan:** When `lessonId` present, progress from that lesson’s vocab ids (or matching roadmap day).
- **Tests:** forced lesson ≠ today → pct follows forced ids.

### F6 — Orphan `vocabSourceIds` — **P1** (edge)

- **Evidence:** Missing cards → `cardNeedsLessonPass` true forever; queue cannot include missing ids.
- **Plan:** When reviewing with `lessonId`, call `ensureLessonCards` before queue build (page already often does; harden in refresh).
- **Tests:** ensure adds missing curriculum cards.

---

## P2 (deferred usability)

| ID | Issue |
|----|--------|
| U1 | Hub “due” = full `studyQueue` length, not due-only |
| U2 | After grade, `setIndex(0)` session UX |
| U3 | UTC `todayKey` vs ICT midnight |
| U4 | `getPathAdvice` unused in UI |
| U5 | Evidence grade counters never decay |
| U6 | Empty-queue copy when `needsQuality` |

---

## Explicitly deferred (not Phase 3)

- AI flashcards / batch generation / quiz-from-document  
- Paid APIs, auth sync, new DB  
- Wiring full `getPathAdvice` UI  
- Freemium re-enable  
- Local-timezone day keys  
- Changing hub mastery from “touched” to retention-weighted formula  
- Playwright suite  

---

## Implementation order

1. F5 (P0)  
2. F3, F2, F4, F1 (P1)  
3. F6 harden (P1 edge)  
4. Inkbar `getOrInsertComputed` — **only if** production browsers without Chrome 145+ are in support scope (see Phase 2 notes): small Map polyfill scoped to PDF viewer, not a global app polyfill.
