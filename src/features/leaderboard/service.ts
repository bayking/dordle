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

  const entries: Omit<LeaderboardEntry, 'rank'>[] = [];

  for (const user of users) {
    const userGames = gamesByUser.get(user.id);
    if (!userGames || userGames.length === 0) continue;

    const winningGames = userGames.filter((g) => g.score !== Score.Fail);
    const winScores = winningGames.map((g) => g.score);
    const average = winScores.length > 0
      ? winScores.reduce((a, b) => a + b, 0) / winScores.length
      : Infinity;
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
