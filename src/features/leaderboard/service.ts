import { Score } from '@/features/stats';
import * as repo from '@/features/leaderboard/repository';
import type { Game } from '@/db/schema';

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

    entries.push({
      discordId: user.discordId,
      wordleUsername: user.wordleUsername,
      gamesPlayed: userGames.length,
      average,
      wins: winningGames.length,
      winRate: (winningGames.length / userGames.length) * 100,
    });
  }

  entries.sort((a, b) => a.average - b.average);

  const rankedEntries: LeaderboardEntry[] = [];
  let currentRank = 1;
  let previousAverage: number | null = null;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;

    if (previousAverage !== null && entry.average !== previousAverage) {
      currentRank = i + 1;
    }

    rankedEntries.push({
      rank: currentRank,
      ...entry,
    });

    previousAverage = entry.average;
  }

  return rankedEntries;
}
