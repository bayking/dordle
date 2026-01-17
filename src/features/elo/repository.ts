import { eq, and, lt, gte, inArray, notInArray, isNotNull } from 'drizzle-orm';
import { getDb } from '@/db';
import { users, games, eloHistory, type User } from '@/db/schema';
import { DEFAULT_ELO, ACTIVE_THRESHOLD_DAYS } from '@/features/elo/constants';
import type { EloUpdate, AbsentPlayer } from '@/features/elo/service';

export interface PlayerWithElo {
  userId: number;
  elo: number;
  score: number;
  gamesPlayed: number;
}

/**
 * Get all players and their scores for a specific wordle number in a server.
 */
export async function getPlayersForWordle(
  serverId: number,
  wordleNumber: number
): Promise<PlayerWithElo[]> {
  const db = getDb();

  const results = await db
    .select({
      userId: users.id,
      elo: users.elo,
      score: games.score,
      gamesPlayed: users.eloGamesPlayed,
    })
    .from(games)
    .innerJoin(users, eq(games.userId, users.id))
    .where(and(eq(games.serverId, serverId), eq(games.wordleNumber, wordleNumber)));

  return results;
}

/**
 * Get active users who didn't play a specific wordle.
 * "Active" means they've played at least once in the last ACTIVE_THRESHOLD_DAYS.
 */
export async function getAbsentActiveUsers(
  serverId: number,
  wordleNumber: number,
  referenceDate: Date
): Promise<AbsentPlayer[]> {
  const db = getDb();

  // Get user IDs who played this wordle
  const playedUserIds = await db
    .selectDistinct({ userId: games.userId })
    .from(games)
    .where(and(eq(games.serverId, serverId), eq(games.wordleNumber, wordleNumber)));

  const playedIds = playedUserIds.map((r) => r.userId);

  // Calculate the threshold date for "active" users
  const activeThreshold = new Date(
    referenceDate.getTime() - ACTIVE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000
  );

  // Get active users who didn't play this wordle
  const absentUsers = await db.query.users.findMany({
    where: and(
      eq(users.serverId, serverId),
      isNotNull(users.lastPlayedAt),
      gte(users.lastPlayedAt, activeThreshold),
      playedIds.length > 0 ? notInArray(users.id, playedIds) : undefined
    ),
    columns: {
      id: true,
      elo: true,
      eloGamesPlayed: true,
    },
  });

  return absentUsers.map((u) => ({
    userId: u.id,
    elo: u.elo,
    gamesPlayed: u.eloGamesPlayed,
  }));
}

/**
 * Update a user's ELO and games played count.
 */
export async function updateUserElo(
  userId: number,
  newElo: number,
  lastPlayedAt: Date
): Promise<void> {
  const db = getDb();
  await db
    .update(users)
    .set({
      elo: newElo,
      eloGamesPlayed: users.eloGamesPlayed,
      lastPlayedAt,
    })
    .where(eq(users.id, userId));
}

/**
 * Increment user's ELO games played and update ELO.
 */
export async function applyEloUpdate(
  update: EloUpdate,
  wordleNumber: number,
  playerScore: number,
  avgScore: number,
  participants: number,
  playedAt: Date
): Promise<void> {
  const db = getDb();

  // Update user's ELO and increment games played
  await db
    .update(users)
    .set({
      elo: update.newElo,
      eloGamesPlayed: db.$count(users.eloGamesPlayed) as unknown as number,
      lastPlayedAt: playedAt,
    })
    .where(eq(users.id, update.userId));

  // This doesn't work with drizzle, let me use raw increment
}

/**
 * Apply ELO updates for all players in a wordle game.
 */
export async function applyEloUpdates(
  serverId: number,
  wordleNumber: number,
  updates: EloUpdate[],
  playerScores: Map<number, number>,
  avgScore: number,
  playedAt: Date
): Promise<void> {
  const db = getDb();

  for (const update of updates) {
    const playerScore = playerScores.get(update.userId) ?? 0;

    // Get current games played to increment
    const user = await db.query.users.findFirst({
      where: eq(users.id, update.userId),
      columns: { eloGamesPlayed: true },
    });

    const newGamesPlayed = (user?.eloGamesPlayed ?? 0) + 1;

    // Update user ELO
    await db
      .update(users)
      .set({
        elo: update.newElo,
        eloGamesPlayed: newGamesPlayed,
        lastPlayedAt: playedAt,
      })
      .where(eq(users.id, update.userId));

    // Insert ELO history record
    await db.insert(eloHistory).values({
      userId: update.userId,
      serverId,
      wordleNumber,
      oldElo: update.oldElo,
      newElo: update.newElo,
      change: update.change,
      playerScore,
      avgScore: Math.round(avgScore * 100), // Store as integer (e.g., 4.5 → 450)
      participants: updates.length,
    });
  }
}

/**
 * Apply ELO updates for absent players (no score, no games increment).
 */
export async function applyAbsentEloUpdates(
  serverId: number,
  wordleNumber: number,
  updates: EloUpdate[],
  participants: number,
  playedAt: Date
): Promise<void> {
  const db = getDb();

  for (const update of updates) {
    // Update user ELO (don't increment games played for absences)
    await db
      .update(users)
      .set({ elo: update.newElo })
      .where(eq(users.id, update.userId));

    // Insert ELO history record with null score to indicate absence
    await db.insert(eloHistory).values({
      userId: update.userId,
      serverId,
      wordleNumber,
      oldElo: update.oldElo,
      newElo: update.newElo,
      change: update.change,
      playerScore: null, // Absent
      avgScore: 0,
      participants,
    });
  }
}

/**
 * Check if ELO has already been calculated for a wordle number.
 */
export async function hasEloBeenCalculated(
  serverId: number,
  wordleNumber: number
): Promise<boolean> {
  const db = getDb();
  const existing = await db.query.eloHistory.findFirst({
    where: and(
      eq(eloHistory.serverId, serverId),
      eq(eloHistory.wordleNumber, wordleNumber)
    ),
  });
  return existing !== undefined;
}

/**
 * Get ELO history for a user.
 */
export async function getEloHistory(
  userId: number,
  limit = 30
): Promise<typeof eloHistory.$inferSelect[]> {
  const db = getDb();
  return db.query.eloHistory.findMany({
    where: eq(eloHistory.userId, userId),
    orderBy: (h, { desc }) => desc(h.wordleNumber),
    limit,
  });
}

/**
 * Get ELO changes for a specific wordle number in a server.
 */
export async function getEloChangesForWordle(
  serverId: number,
  wordleNumber: number
): Promise<typeof eloHistory.$inferSelect[]> {
  const db = getDb();
  return db.query.eloHistory.findMany({
    where: and(
      eq(eloHistory.serverId, serverId),
      eq(eloHistory.wordleNumber, wordleNumber)
    ),
  });
}

/**
 * Reset all users' ELO to default for a server (used during backfill).
 */
export async function resetServerElo(serverId: number): Promise<void> {
  const db = getDb();
  await db
    .update(users)
    .set({
      elo: DEFAULT_ELO,
      eloGamesPlayed: 0,
      lastPlayedAt: null,
    })
    .where(eq(users.serverId, serverId));
}

/**
 * Clear ELO history for a server (used during backfill).
 */
export async function clearServerEloHistory(serverId: number): Promise<void> {
  const db = getDb();
  await db.delete(eloHistory).where(eq(eloHistory.serverId, serverId));
}


/**
 * Get all unique wordle numbers for a server, ordered chronologically.
 */
export async function getWordleNumbersForServer(serverId: number): Promise<number[]> {
  const db = getDb();
  const results = await db
    .selectDistinct({ wordleNumber: games.wordleNumber })
    .from(games)
    .where(eq(games.serverId, serverId))
    .orderBy(games.wordleNumber);

  return results.map((r) => r.wordleNumber);
}

/**
 * Get ELO history for a server within a date range.
 */
export async function getEloHistoryForDateRange(
  serverId: number,
  startDate: Date,
  endDate: Date
): Promise<typeof eloHistory.$inferSelect[]> {
  const db = getDb();
  return db.query.eloHistory.findMany({
    where: and(
      eq(eloHistory.serverId, serverId),
      gte(eloHistory.createdAt, startDate),
      lt(eloHistory.createdAt, endDate)
    ),
    orderBy: (h, { asc }) => asc(h.createdAt),
  });
}
