import { sqliteTable, text, integer, unique } from 'drizzle-orm/sqlite-core';

export const servers = sqliteTable('servers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  discordId: text('discord_id').notNull().unique(),
  wordleChannelId: text('wordle_channel_id'),
  summaryChannelId: text('summary_channel_id'),
  timezone: text('timezone').default('UTC'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const users = sqliteTable(
  'users',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    serverId: integer('server_id')
      .notNull()
      .references(() => servers.id, { onDelete: 'cascade' }),
    discordId: text('discord_id').notNull(),
    wordleUsername: text('wordle_username'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [unique().on(table.serverId, table.discordId)]
);

export const games = sqliteTable(
  'games',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    serverId: integer('server_id')
      .notNull()
      .references(() => servers.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    wordleNumber: integer('wordle_number').notNull(),
    score: integer('score').notNull(), // 1-6 for wins, 7 for X/fail
    playedAt: integer('played_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    messageId: text('message_id'),
  },
  (table) => [unique().on(table.serverId, table.userId, table.wordleNumber)]
);

export const scheduledPosts = sqliteTable('scheduled_posts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  serverId: integer('server_id')
    .notNull()
    .references(() => servers.id, { onDelete: 'cascade' }),
  type: text('type', { enum: ['daily', 'weekly', 'monthly'] }).notNull(),
  lastPostedAt: integer('last_posted_at', { mode: 'timestamp' }),
});

export type Server = typeof servers.$inferSelect;
export type NewServer = typeof servers.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Game = typeof games.$inferSelect;
export type NewGame = typeof games.$inferInsert;
export type ScheduledPost = typeof scheduledPosts.$inferSelect;
export type NewScheduledPost = typeof scheduledPosts.$inferInsert;
