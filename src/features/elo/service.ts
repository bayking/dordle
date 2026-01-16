import {
  K_FACTOR_PROVISIONAL,
  K_FACTOR_ESTABLISHING,
  K_FACTOR_ESTABLISHED,
  PROVISIONAL_GAMES,
  ESTABLISHING_GAMES,
  MIN_PLAYERS_FOR_ELO,
  FAIL_EFFECTIVE_SCORE,
  EXPECTED_SCORE_MIN,
  EXPECTED_SCORE_MAX,
  FAIL_PENALTY,
} from '@/features/elo/constants';

export interface PlayerGame {
  userId: number;
  elo: number;
  score: number;
  gamesPlayed: number;
}

export interface EloUpdate {
  userId: number;
  oldElo: number;
  newElo: number;
  change: number;
}

/**
 * Get the K-factor based on number of games played.
 * New players have higher K-factor for faster rating adjustment.
 */
export function getKFactor(gamesPlayed: number): number {
  if (gamesPlayed <= PROVISIONAL_GAMES) {
    return K_FACTOR_PROVISIONAL;
  }
  if (gamesPlayed <= ESTABLISHING_GAMES) {
    return K_FACTOR_ESTABLISHING;
  }
  return K_FACTOR_ESTABLISHED;
}

/**
 * Calculate expected score against a single opponent using ELO formula.
 * Returns value between 0.1 and 0.9 (capped to prevent extreme changes).
 */
function calculateExpectedScore(playerElo: number, opponentElo: number): number {
  const exponent = (opponentElo - playerElo) / 400;
  const rawExpected = 1 / (1 + Math.pow(10, exponent));
  return Math.max(EXPECTED_SCORE_MIN, Math.min(EXPECTED_SCORE_MAX, rawExpected));
}

/**
 * Get effective score for ELO calculation.
 * Fail (7) is treated as 9 for harsher penalty.
 */
function getEffectiveScore(score: number): number {
  return score === 7 ? FAIL_EFFECTIVE_SCORE : score;
}

/**
 * Calculate actual result against a single opponent.
 * Returns 1.0 for win, 0.5 for tie, 0.0 for loss.
 */
function calculateActualResult(playerScore: number, opponentScore: number): number {
  const playerEffective = getEffectiveScore(playerScore);
  const opponentEffective = getEffectiveScore(opponentScore);

  if (playerEffective < opponentEffective) return 1.0; // Win (lower is better)
  if (playerEffective === opponentEffective) return 0.5; // Tie
  return 0.0; // Loss
}

/**
 * Calculate ELO changes for all players in a daily game using pairwise comparison.
 * Each player is compared head-to-head against every other player.
 */
export function calculateDailyEloChanges(players: PlayerGame[]): EloUpdate[] {
  // Not enough players for meaningful competition
  if (players.length < MIN_PLAYERS_FOR_ELO) {
    return players.map((p) => ({
      userId: p.userId,
      oldElo: p.elo,
      newElo: p.elo,
      change: 0,
    }));
  }

  const updates: EloUpdate[] = [];

  for (const player of players) {
    const opponents = players.filter((p) => p.userId !== player.userId);

    let totalExpected = 0;
    let totalActual = 0;

    for (const opponent of opponents) {
      // Expected score against this opponent (capped)
      const expected = calculateExpectedScore(player.elo, opponent.elo);
      totalExpected += expected;

      // Actual result against this opponent
      const actual = calculateActualResult(player.score, opponent.score);
      totalActual += actual;
    }

    // Normalize by number of opponents
    const avgExpected = totalExpected / opponents.length;
    const avgActual = totalActual / opponents.length;

    // Calculate ELO change
    const kFactor = getKFactor(player.gamesPlayed);
    let change = Math.round(kFactor * (avgActual - avgExpected));

    // Minimum change for clear win/loss (prevents 0 change when player clearly won or lost)
    if (avgActual > avgExpected && change < 1) change = 1;
    if (avgActual < avgExpected && change > -1) change = -1;

    // Additional fail penalty
    if (player.score === 7) {
      change -= FAIL_PENALTY;
    }

    updates.push({
      userId: player.userId,
      oldElo: player.elo,
      newElo: player.elo + change,
      change,
    });
  }

  return updates;
}
