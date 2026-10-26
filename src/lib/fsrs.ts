"use client";

import {
  Card,
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  State,
  type Grade,
} from "ts-fsrs";

export { Rating, State, createEmptyCard };
export type { Card, Grade };

const scheduler = fsrs(
  generatorParameters({
    enable_fuzz: false,
    enable_short_term: true,
  }),
);

export type CardSnapshot = {
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: State;
  last_review?: string;
};

export function serializeCard(card: Card): CardSnapshot {
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review ? card.last_review.toISOString() : undefined,
  };
}

export function deserializeCard(raw: CardSnapshot): Card {
  return {
    due: new Date(raw.due),
    stability: raw.stability,
    difficulty: raw.difficulty,
    elapsed_days: raw.elapsed_days ?? 0,
    scheduled_days: raw.scheduled_days,
    learning_steps: raw.learning_steps ?? 0,
    reps: raw.reps,
    lapses: raw.lapses,
    state: raw.state,
    last_review: raw.last_review ? new Date(raw.last_review) : undefined,
  };
}

/**
 * Migrate old snapshots. New cards must be { stability: 0, difficulty: 0 }.
 * Older coerce used difficulty: 5 + stability: 0 → ts-fsrs 5.x throws FSRSValidationError.
 */
export function coerceSnapshot(raw: Partial<CardSnapshot> & { due: string }): CardSnapshot {
  const stability = Number(raw.stability);
  const difficulty = Number(raw.difficulty);
  const state = (raw.state as State) ?? State.New;
  const safeStability = Number.isFinite(stability) ? stability : 0;
  let safeDifficulty = Number.isFinite(difficulty) ? difficulty : 0;

  // New / never-reviewed: difficulty must be 0 when stability is 0
  if (safeStability <= 0 && safeDifficulty !== 0) {
    safeDifficulty = 0;
  }

  return {
    due: raw.due,
    stability: Math.max(0, safeStability),
    difficulty: Math.max(0, safeDifficulty),
    elapsed_days: raw.elapsed_days ?? 0,
    scheduled_days: raw.scheduled_days ?? 0,
    learning_steps: raw.learning_steps ?? 0,
    reps: raw.reps ?? 0,
    lapses: raw.lapses ?? 0,
    state,
    last_review: raw.last_review,
  };
}

/** Repair cards that would crash scheduler.next (e.g. legacy difficulty:5 + stability:0). */
export function sanitizeCard(card: Card, now = new Date()): Card {
  const stability = Number(card.stability) || 0;
  const difficulty = Number(card.difficulty) || 0;
  if (stability <= 0 && difficulty !== 0) {
    const fresh = createEmptyCard(now);
    return {
      ...fresh,
      due: card.due instanceof Date ? card.due : new Date(card.due),
      reps: card.reps || 0,
      lapses: card.lapses || 0,
    };
  }
  if (!Number.isFinite(card.stability) || !Number.isFinite(card.difficulty)) {
    return createEmptyCard(now);
  }
  return card;
}

export function schedule(card: Card, now: Date, grade: Grade): Card {
  const safe = sanitizeCard(card, now);
  try {
    return scheduler.next(safe, now, grade).card;
  } catch {
    // Last resort: re-seed as new card and apply grade once
    const fresh = createEmptyCard(now);
    return scheduler.next(fresh, now, grade).card;
  }
}

export function newCard(now = new Date()): Card {
  return createEmptyCard(now);
}
