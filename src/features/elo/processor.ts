import { log } from '@/infrastructure/logger';
import { calculateDailyEloChanges, type PlayerGame } from '@/features/elo/service';
import {
  getPlayersForWordle,
  applyEloUpdates,
  hasEloBeenCalculated,
  resetServerElo,
  clearServerEloHistory,
  getWordleNumbersForServer,
} from '@/features/elo/repository';
import { MIN_PLAYERS_FOR_ELO, FAIL_EFFECTIVE_SCORE } from '@/features/elo/constants';

/**
 * Process ELO updates for a specific wordle number.
 * Returns true if ELO was calculated, false if skipped.
 */
export async function processWordleElo(
  serverId: number,
  wordleNumber: number,
  playedAt: Date = new Date()
): Promise<boolean> {
  // Check if already calculated
  const alreadyCalculated = await hasEloBeenCalculated(serverId, wordleNumber);
  if (alreadyCalculated) {
    log.debug({ serverId, wordleNumber }, 'ELO already calculated, skipping');
    return false;
  }

  // Get all players for this wordle
  const players = await getPlayersForWordle(serverId, wordleNumber);

  if (players.length < MIN_PLAYERS_FOR_ELO) {
    log.debug(
      { serverId, wordleNumber, playerCount: players.length },
      'Not enough players for ELO calculation'
    );
    return false;
  }

  // Convert to PlayerGame format
  const playerGames: PlayerGame[] = players.map((p) => ({
    userId: p.userId,
    elo: p.elo,
    score: p.score,
    gamesPlayed: p.gamesPlayed,
  }));

  // Calculate ELO changes
  const updates = calculateDailyEloChanges(playerGames);

  // Calculate average score for history
  const effectiveScores = players.map((p) =>
    p.score === 7 ? FAIL_EFFECTIVE_SCORE : p.score
  );
  const avgScore = effectiveScores.reduce((a, b) => a + b, 0) / effectiveScores.length;

  // Build score map
  const playerScores = new Map<number, number>();
  for (const p of players) {
    playerScores.set(p.userId, p.score);
  }

  // Apply updates
  await applyEloUpdates(serverId, wordleNumber, updates, playerScores, avgScore, playedAt);

  log.info(
    {
      serverId,
      wordleNumber,
      participants: players.length,
      updates: updates.map((u) => ({ userId: u.userId, change: u.change })),
    },
    'ELO calculated'
  );

  return true;
}

/**
 * Recalculate all ELO for a server from scratch.
 * Used during backfill to ensure consistent ELO history.
 */
export async function recalculateServerElo(serverId: number): Promise<{
  wordlesProcessed: number;
  playersAffected: Set<number>;
}> {
  log.info({ serverId }, 'Starting ELO recalculation');

  // Reset all ELO to default
  await resetServerElo(serverId);
  await clearServerEloHistory(serverId);

  // Get all wordle numbers in chronological order
  const wordleNumbers = await getWordleNumbersForServer(serverId);

  const playersAffected = new Set<number>();
  let wordlesProcessed = 0;

  // Process each wordle in order
  for (const wordleNumber of wordleNumbers) {
    const players = await getPlayersForWordle(serverId, wordleNumber);

    if (players.length >= MIN_PLAYERS_FOR_ELO) {
      // Need to refetch players to get their CURRENT (updated) ELO
      // since we're processing in order
      const currentPlayers = await getPlayersForWordle(serverId, wordleNumber);

      const playerGames: PlayerGame[] = currentPlayers.map((p) => ({
        userId: p.userId,
        elo: p.elo,
        score: p.score,
        gamesPlayed: p.gamesPlayed,
      }));

      const updates = calculateDailyEloChanges(playerGames);

      const effectiveScores = currentPlayers.map((p) =>
        p.score === 7 ? FAIL_EFFECTIVE_SCORE : p.score
      );
      const avgScore =
        effectiveScores.reduce((a, b) => a + b, 0) / effectiveScores.length;

      const playerScores = new Map<number, number>();
      for (const p of currentPlayers) {
        playerScores.set(p.userId, p.score);
        playersAffected.add(p.userId);
      }

      // Use a date based on wordle number (approximate)
      const playedAt = new Date();
      await applyEloUpdates(
        serverId,
        wordleNumber,
        updates,
        playerScores,
        avgScore,
        playedAt
      );

      wordlesProcessed++;
    }
  }

  log.info(
    { serverId, wordlesProcessed, playersAffected: playersAffected.size },
    'ELO recalculation complete'
  );

  return { wordlesProcessed, playersAffected };
}
