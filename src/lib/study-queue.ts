/**
 * Pure study-queue assembly helpers (Slice 2A).
 * Kept free of localStorage / Next so Node smoke tests can import this module.
 */

/** Soft cap: max never-reviewed Desk/manual cards injected per review session. */
export const DESK_NEW_SOFT_CAP = 10;

export function isManualDeskCardId(sourceId: string): boolean {
  return typeof sourceId === "string" && sourceId.startsWith("manual-");
}

export type StudyQueueLive = {
  reps: number;
  due: Date;
};

export type StudyQueueItemBase = {
  sourceId: string;
  live: StudyQueueLive;
};

export type AssembledQueueItem<T extends StudyQueueItemBase> = T & {
  queueKind: "new" | "review";
};

export type AssembleStudyQueueInput<T extends StudyQueueItemBase> = {
  cards: T[];
  /** Active lesson vocab source ids (may be empty). */
  lessonSourceIds: string[];
  /** Whether a lesson card still needs work (Again/Hard / untouched). */
  needsLessonPass: (sourceId: string) => boolean;
  nowMs: number;
  /** Remaining daily review quota (freemium); Infinity when unlocked. */
  remainingQuota: number;
  /** Max lesson-work slots after applying newLeft/quota (caller computes). */
  lessonWorkSlotLimit: number;
  /** Max due-outside-lesson slots (caller computes from remaining quota). */
  dueSlotLimit: number;
  /** Soft cap for new Desk/manual cards only (default DESK_NEW_SOFT_CAP). */
  deskNewSoftCap?: number;
};

/**
 * Priority: (1) lesson work (2) due reviews outside lesson (3) new Desk/manual (reps===0).
 * Desk-new soft cap never reduces due or lesson slots.
 * Each sourceId appears at most once.
 */
export function assembleStudyQueue<T extends StudyQueueItemBase>(
  input: AssembleStudyQueueInput<T>,
): AssembledQueueItem<T>[] {
  const allowNew = new Set(input.lessonSourceIds.filter(Boolean));
  const cap = Math.max(0, input.deskNewSoftCap ?? DESK_NEW_SOFT_CAP);
  const quota = Math.max(0, input.remainingQuota);

  const lessonWork: AssembledQueueItem<T>[] =
    allowNew.size > 0
      ? input.cards
          .filter((c) => allowNew.has(c.sourceId) && input.needsLessonPass(c.sourceId))
          .map((c) => ({
            ...c,
            queueKind: ((c.live.reps ?? 0) > 0 ? "review" : "new") as "new" | "review",
          }))
      : [];

  const work = lessonWork.slice(0, Math.min(input.lessonWorkSlotLimit, lessonWork.length, quota));
  const taken = new Set(work.map((c) => c.sourceId));

  const dueOutsideLesson = input.cards
    .filter(
      (c) =>
        !taken.has(c.sourceId) &&
        (c.live.reps ?? 0) > 0 &&
        c.live.due.getTime() <= input.nowMs &&
        !(allowNew.size > 0 && allowNew.has(c.sourceId)),
    )
    .sort((a, b) => {
      const dd = a.live.due.getTime() - b.live.due.getTime();
      if (dd !== 0) return dd;
      return a.sourceId < b.sourceId ? -1 : a.sourceId > b.sourceId ? 1 : 0;
    })
    .map((c) => ({ ...c, queueKind: "review" as const }));

  const dueBudget = Math.min(
    input.dueSlotLimit,
    dueOutsideLesson.length,
    Math.max(0, quota - work.length),
  );
  const due = dueOutsideLesson.slice(0, dueBudget);
  for (const c of due) taken.add(c.sourceId);

  // Preserve track card order (newest manuals are unshifted first) for determinism.
  const deskNew = input.cards
    .filter(
      (c) =>
        !taken.has(c.sourceId) &&
        isManualDeskCardId(c.sourceId) &&
        (c.live.reps ?? 0) === 0,
    )
    .map((c) => ({ ...c, queueKind: "new" as const }));

  const deskBudget = Math.min(cap, deskNew.length, Math.max(0, quota - work.length - due.length));
  const desk = deskNew.slice(0, deskBudget);

  return [...work, ...due, ...desk];
}
