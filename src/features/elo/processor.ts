import { log } from '@/infrastructure/logger';
import {
  calculateDailyEloChanges,
  calculateAbsentPlayerEloChanges,
  type PlayerGame,
} from '@/features/elo/service';
import {
  getPlayersForWordle,
  getAbsentActiveUsers,
  applyEloUpdates,
  applyAbsentEloUpdates,
  hasEloBeenCalculated,
  resetServerElo,
  clearServerEloHistory,
  getWordleNumbersForServer,
} from '@/features/elo/repository';
import { MIN_PLAYERS_FOR_ELO, FAIL_EFFECTIVE_SCORE } from '@/features/elo/constants';

/**
 * Process ELO updates for a specific wordle number.
 * Includes penalties for active users who didn't play.
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

  // Calculate ELO changes for participants
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

  // Apply updates for participants
  await applyEloUpdates(serverId, wordleNumber, updates, playerScores, avgScore, playedAt);

  // Get active users who didn't play and apply penalties
  const absentPlayers = await getAbsentActiveUsers(serverId, wordleNumber, playedAt);
  if (absentPlayers.length > 0) {
    const absentUpdates = calculateAbsentPlayerEloChanges(playerGames, absentPlayers);
    await applyAbsentEloUpdates(serverId, wordleNumber, absentUpdates, players.length, playedAt);

    log.info(
      {
        serverId,
        wordleNumber,
        absentPlayers: absentPlayers.length,
        absentUpdates: absentUpdates.map((u) => ({ userId: u.userId, change: u.change })),
      },
      'Absent player ELO penalties applied'
    );
  }

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
 * Applies absent penalties: once a player has played, missing any future wordle = loss.
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

  // Track all players who have played at least once
  const activePlayers = new Map<number, { elo: number; gamesPlayed: number }>();
  const playersAffected = new Set<number>();
  let wordlesProcessed = 0;

  // Process each wordle in order
  for (const wordleNumber of wordleNumbers) {
    const players = await getPlayersForWordle(serverId, wordleNumber);

    if (players.length >= MIN_PLAYERS_FOR_ELO) {
      const playerGames: PlayerGame[] = players.map((p) => {
        // Use tracked ELO if we have it, otherwise use DB value
        const tracked = activePlayers.get(p.userId);
        return {
          userId: p.userId,
          elo: tracked?.elo ?? p.elo,
          score: p.score,
          gamesPlayed: tracked?.gamesPlayed ?? p.gamesPlayed,
        };
      });

      const updates = calculateDailyEloChanges(playerGames);

      const effectiveScores = players.map((p) =>
        p.score === 7 ? FAIL_EFFECTIVE_SCORE : p.score
      );
      const avgScore =
        effectiveScores.reduce((a, b) => a + b, 0) / effectiveScores.length;

      const playerScores = new Map<number, number>();
      const participantIds = new Set<number>();
      for (const p of players) {
        playerScores.set(p.userId, p.score);
        playersAffected.add(p.userId);
        participantIds.add(p.userId);
      }

      const playedAt = new Date();
      await applyEloUpdates(
        serverId,
        wordleNumber,
        updates,
        playerScores,
        avgScore,
        playedAt
      );

      // Update tracked ELO for participants
      for (const update of updates) {
        const current = activePlayers.get(update.userId);
        activePlayers.set(update.userId, {
          elo: update.newElo,
          gamesPlayed: (current?.gamesPlayed ?? 0) + 1,
        });
      }

      // Apply absent penalties to players who have played before but missed this one
      const absentPlayers = [...activePlayers.entries()]
        .filter(([userId]) => !participantIds.has(userId))
        .map(([userId, data]) => ({
          userId,
          elo: data.elo,
          gamesPlayed: data.gamesPlayed,
        }));

      if (absentPlayers.length > 0) {
        const absentUpdates = calculateAbsentPlayerEloChanges(playerGames, absentPlayers);
        await applyAbsentEloUpdates(serverId, wordleNumber, absentUpdates, players.length, playedAt);

        // Update tracked ELO for absent players
        for (const update of absentUpdates) {
          const current = activePlayers.get(update.userId)!;
          activePlayers.set(update.userId, {
            elo: update.newElo,
            gamesPlayed: current.gamesPlayed,
          });
        }

        log.debug(
          { wordleNumber, absentCount: absentPlayers.length },
          'Applied absent penalties during recalculation'
        );
      }

      wordlesProcessed++;
    }
  }

  log.info(
    { serverId, wordlesProcessed, playersAffected: playersAffected.size },
    'ELO recalculation complete'
  );

  return { wordlesProcessed, playersAffected };
}
