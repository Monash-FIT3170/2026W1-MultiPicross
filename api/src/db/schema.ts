import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const accounts = pgTable("accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  username: text("username").unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const refreshTokens = pgTable("refresh_tokens", {
  id: uuid("id").primaryKey(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const nonograms = pgTable("nonograms", {
  id: text("id").primaryKey(),
  width: smallint("width").notNull(),
  height: smallint("height").notNull(),
  solution: jsonb("solution").notNull(),
  rowClues: jsonb("row_clues").notNull(),
  colClues: jsonb("col_clues").notNull(),
  colors: jsonb("colors").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const spCompletionState = pgEnum("sp_completion_state", [
  "active",
  "completed",
  "failed",
  "abandoned",
]);

export const spCompletions = pgTable(
  "sp_completions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    puzzleId: text("puzzle_id")
      .notNull()
      .references(() => nonograms.id, { onDelete: "cascade" }),
    state: spCompletionState("state").notNull().default("active"),
    confirmedFilled: jsonb("confirmed_filled").notNull(),
    crosses: jsonb("crosses").notNull(),
    revealedEmpty: jsonb("revealed_empty").notNull(),
    mistakeCross: jsonb("mistake_cross")
      .notNull()
      .default(sql`'[]'::jsonb`),
    livesLeft: smallint("lives_left").notNull().default(3),
    elapsedSeconds: integer("elapsed_seconds").notNull().default(0),
    lastResumedAt: timestamp("last_resumed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table: any) => [
    uniqueIndex("sp_completions_account_active_idx")
      .on(table.accountId)
      .where(sql`state = 'active'`),
  ],
);

export const playerEloHistory = pgTable("player_elo_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  elo: integer("elo").notNull(),
  recordedAt: timestamp("recorded_at").defaultNow().notNull(),
});

export const ratedWaitingList = pgTable("rated_waiting_list", {
  id: uuid("id").defaultRandom().primaryKey(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});
