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
  ABSENT_ELO_FLOOR,
  DAILY_WINNER_BONUS,
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

export interface AbsentPlayer {
  userId: number;
  elo: number;
  gamesPlayed: number;
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
 * Daily winner(s) with the best score get a bonus.
 */
export function calculateDailyEloChanges(players: PlayerGame[]): EloUpdate[] {
  if (players.length === 0) {
    return [];
  }

  // Find the best (lowest) score for winner bonus
  const bestScore = Math.min(...players.map((p) => p.score));

  // Solo player: no pairwise comparison, just winner bonus and fail penalty
  if (players.length === 1) {
    const player = players[0]!;
    let change = DAILY_WINNER_BONUS; // Solo player is always the winner
    if (player.score === 7) {
      change -= FAIL_PENALTY;
    }
    return [{
      userId: player.userId,
      oldElo: player.elo,
      newElo: player.elo + change,
      change,
    }];
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

    // Daily winner bonus for best score
    if (player.score === bestScore) {
      change += DAILY_WINNER_BONUS;
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

/**
 * Calculate ELO changes for absent players.
 * Absent players are treated as having lost to all participants.
 * The penalty scales with the number of participants (more people = more losses).
 */
export function calculateAbsentPlayerEloChanges(
  participants: PlayerGame[],
  absentPlayers: AbsentPlayer[]
): EloUpdate[] {
  // Not enough participants for meaningful competition
  if (participants.length < MIN_PLAYERS_FOR_ELO) {
    return [];
  }

  if (absentPlayers.length === 0) {
    return [];
  }

  const updates: EloUpdate[] = [];

  for (const absent of absentPlayers) {
    let totalChange = 0;

    // Calculate ELO change against each participant individually
    for (const participant of participants) {
      // Expected score against this participant (capped)
      const expected = calculateExpectedScore(absent.elo, participant.elo);
      const actual = 0; // Loss

      // Calculate ELO change for this matchup
      const kFactor = getKFactor(absent.gamesPlayed);
      totalChange += kFactor * (actual - expected);
    }

    // Round the total change
    let change = Math.round(totalChange);

    // Minimum change for clear loss
    if (change > -1) change = -1;

    // Apply ELO floor
    const newElo = Math.max(ABSENT_ELO_FLOOR, absent.elo + change);
    const actualChange = newElo - absent.elo;

    updates.push({
      userId: absent.userId,
      oldElo: absent.elo,
      newElo,
      change: actualChange,
    });
  }

  return updates;
}
