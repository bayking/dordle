import { Score } from '@/features/stats';
import * as repo from '@/features/leaderboard/repository';
import type { Game } from '@/db/schema';

function calculateStreaks(games: Game[]): { currentStreak: number; maxStreak: number } {
  // Sort games by wordle number to ensure chronological order
  const sorted = [...games].sort((a, b) => a.wordleNumber - b.wordleNumber);

  let maxStreak = 0;
  let streak = 0;

  for (const game of sorted) {
    if (game.score !== Score.Fail) {
      streak++;
      maxStreak = Math.max(maxStreak, streak);
    } else {
      streak = 0;
    }
  }

  return { currentStreak: streak, maxStreak };
}

/**
 * Calculate average score including missed wordles as fails (7).
 * Range: from player's first wordle to max wordle in the dataset.
 */
function calculateAverageWithMisses(userGames: Game[], maxWordleNumber: number): number {
  if (userGames.length === 0) return Infinity;

  // Find player's first and last wordle
  const wordleNumbers = userGames.map((g) => g.wordleNumber);
  const minWordle = Math.min(...wordleNumbers);

  // Build set of wordles the player actually played
  const playedWordles = new Set(wordleNumbers);

  // Sum scores: played games + missed games as 7
  let totalScore = 0;
  let totalGames = 0;

  for (let wn = minWordle; wn <= maxWordleNumber; wn++) {
    if (playedWordles.has(wn)) {
      const game = userGames.find((g) => g.wordleNumber === wn)!;
      totalScore += game.score;
    } else {
      // Missed wordle counts as 7
      totalScore += Score.Fail;
    }
    totalGames++;
  }

  return totalGames > 0 ? totalScore / totalGames : Infinity;
}

export enum LeaderboardPeriod {
  AllTime = 'all',
  Weekly = 'weekly',
  Monthly = 'monthly',
}

export interface LeaderboardEntry {
  rank: number;
  discordId: string;
  wordleUsername: string | null;
  gamesPlayed: number;
  average: number;
  wins: number;
  winRate: number;
  currentStreak: number;
  maxStreak: number;
  elo: number;
  eloGamesPlayed: number;
}

export async function getLeaderboard(
  serverId: number,
  period: LeaderboardPeriod
): Promise<LeaderboardEntry[]> {
  const [users, games] = await Promise.all([
    repo.findUsersByServer(serverId),
    repo.findGamesByServerAndPeriod(serverId, period),
  ]);

  const gamesByUser = new Map<number, Game[]>();
  for (const game of games) {
    const userGames = gamesByUser.get(game.userId) ?? [];
    userGames.push(game);
    gamesByUser.set(game.userId, userGames);
  }

  // Find the max wordle number across all games
  const maxWordleNumber = games.length > 0
    ? Math.max(...games.map((g) => g.wordleNumber))
    : 0;

  const entries: Omit<LeaderboardEntry, 'rank'>[] = [];

  for (const user of users) {
    const userGames = gamesByUser.get(user.id);
    if (!userGames || userGames.length === 0) continue;

    // Calculate average including missed wordles as 7
    const average = calculateAverageWithMisses(userGames, maxWordleNumber);
    const winningGames = userGames.filter((g) => g.score !== Score.Fail);
    const { currentStreak, maxStreak } = calculateStreaks(userGames);

    entries.push({
      discordId: user.discordId,
      wordleUsername: user.wordleUsername,
      gamesPlayed: userGames.length,
      average,
      wins: winningGames.length,
      winRate: (winningGames.length / userGames.length) * 100,
      currentStreak,
      maxStreak,
      elo: user.elo,
      eloGamesPlayed: user.eloGamesPlayed,
    });
  }

  // Sort by ELO (higher is better), then by average (lower is better) as tiebreaker
  entries.sort((a, b) => {
    if (b.elo !== a.elo) return b.elo - a.elo;
    return a.average - b.average;
  });

  const rankedEntries: LeaderboardEntry[] = [];
  let currentRank = 1;
  let previousElo: number | null = null;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;

    if (previousElo !== null && entry.elo !== previousElo) {
      currentRank = i + 1;
    }

    rankedEntries.push({
      rank: currentRank,
      ...entry,
    });

    previousElo = entry.elo;
  }

  return rankedEntries;
}
