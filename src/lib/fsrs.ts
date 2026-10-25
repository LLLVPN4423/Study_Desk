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

/** Migrate old fsrs-lite snapshots (missing elapsed_days / learning_steps). */
export function coerceSnapshot(raw: Partial<CardSnapshot> & { due: string }): CardSnapshot {
  return {
    due: raw.due,
    stability: raw.stability ?? 0,
    difficulty: raw.difficulty ?? 5,
    elapsed_days: raw.elapsed_days ?? 0,
    scheduled_days: raw.scheduled_days ?? 0,
    learning_steps: raw.learning_steps ?? 0,
    reps: raw.reps ?? 0,
    lapses: raw.lapses ?? 0,
    state: (raw.state as State) ?? State.New,
    last_review: raw.last_review,
  };
}

export function schedule(card: Card, now: Date, grade: Grade): Card {
  return scheduler.next(card, now, grade).card;
}

export function newCard(now = new Date()): Card {
  return createEmptyCard(now);
}
