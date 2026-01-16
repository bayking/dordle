import { Score } from '@/features/stats';
import * as repo from '@/features/summaries/repository';
import type { Game, User } from '@/db/schema';

export enum SummaryPeriod {
  Daily = 'daily',
  Weekly = 'weekly',
  Monthly = 'monthly',
}

export interface PlayerScore {
  userId: number;
  discordId: string;
  wordleUsername: string | null;
  score: Score;
}

export interface DailySummary {
  wordleNumber: number | null;
  participants: number;
  winner: PlayerScore | null;
  winners: PlayerScore[];
  scores: PlayerScore[];
  groupStreak: number;
}

export interface RankedPlayer {
  userId: number;
  discordId: string;
  wordleUsername: string | null;
  gamesPlayed: number;
  average: number;
  rank: number;
  currentStreak: number;
  maxStreak: number;
}

export interface WeeklySummary {
  totalGames: number;
  uniquePlayers: number;
  rankings: RankedPlayer[];
}

export interface Champion {
  userId: number;
  discordId: string;
  wordleUsername: string | null;
  gamesPlayed: number;
  average: number;
}

export interface MonthlySummary {
  totalGames: number;
  champion: Champion | null;
  bestScore: Score | null;
  averageScore: number | null;
}

function getStartOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function getEndOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

function getYesterday(date: Date): { start: Date; end: Date } {
  const yesterday = new Date(date.getTime() - 86400000);
  return {
    start: getStartOfDay(yesterday),
    end: getEndOfDay(yesterday),
  };
}

function getLastWeek(date: Date): { start: Date; end: Date } {
  const end = new Date(date.getTime() - 86400000);
  const start = new Date(end.getTime() - 6 * 86400000);
  return {
    start: getStartOfDay(start),
    end: getEndOfDay(end),
  };
}

function getLastMonth(date: Date): { start: Date; end: Date } {
  const end = new Date(date.getTime() - 86400000);
  const start = new Date(end);
  start.setUTCMonth(start.getUTCMonth() - 1);
  return {
    start: getStartOfDay(start),
    end: getEndOfDay(end),
  };
}

function buildUserMap(users: User[]): Map<number, User> {
  const map = new Map<number, User>();
  for (const user of users) {
    map.set(user.id, user);
  }
  return map;
}

function calculateStreaks(games: Game[]): { currentStreak: number; maxStreak: number } {
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

export async function generateDailySummary(
  serverId: number,
  referenceDate: Date
): Promise<DailySummary> {
  const { start, end } = getYesterday(referenceDate);
  const [games, users, groupStreak] = await Promise.all([
    repo.findGamesByServerAndDateRange(serverId, start, end),
    repo.findUsersByServer(serverId),
    repo.getServerGroupStreak(serverId),
  ]);

  const userMap = buildUserMap(users);

  if (games.length === 0) {
    return {
      wordleNumber: null,
      participants: 0,
      winner: null,
      winners: [],
      scores: [],
      groupStreak,
    };
  }

  const wordleNumber = games[0]!.wordleNumber;

  const scores: PlayerScore[] = games.map((game) => {
    const user = userMap.get(game.userId);
    return {
      userId: game.userId,
      discordId: user?.discordId ?? '',
      wordleUsername: user?.wordleUsername ?? null,
      score: game.score,
    };
  });

  const winningGames = games.filter((g) => g.score !== Score.Fail);
  const bestScore = winningGames.length > 0
    ? Math.min(...winningGames.map((g) => g.score))
    : null;

  const winners: PlayerScore[] = bestScore !== null
    ? scores.filter((s) => s.score === bestScore)
    : [];

  return {
    wordleNumber,
    participants: games.length,
    winner: winners[0] ?? null,
    winners,
    scores,
    groupStreak,
  };
}

export async function generateWeeklySummary(
  serverId: number,
  referenceDate: Date
): Promise<WeeklySummary> {
  const { start, end } = getLastWeek(referenceDate);
  const [games, users] = await Promise.all([
    repo.findGamesByServerAndDateRange(serverId, start, end),
    repo.findUsersByServer(serverId),
  ]);

  const userMap = buildUserMap(users);

  if (games.length === 0) {
    return {
      totalGames: 0,
      uniquePlayers: 0,
      rankings: [],
    };
  }

  const gamesByUser = new Map<number, Game[]>();
  for (const game of games) {
    const userGames = gamesByUser.get(game.userId) ?? [];
    userGames.push(game);
    gamesByUser.set(game.userId, userGames);
  }

  const playerStats: Omit<RankedPlayer, 'rank'>[] = [];

  for (const [userId, userGames] of gamesByUser) {
    const user = userMap.get(userId);
    const winningGames = userGames.filter((g) => g.score !== Score.Fail);
    const average = winningGames.length > 0
      ? winningGames.reduce((sum, g) => sum + g.score, 0) / winningGames.length
      : Infinity;
    const { currentStreak, maxStreak } = calculateStreaks(userGames);

    playerStats.push({
      userId,
      discordId: user?.discordId ?? '',
      wordleUsername: user?.wordleUsername ?? null,
      gamesPlayed: userGames.length,
      average,
      currentStreak,
      maxStreak,
    });
  }

  playerStats.sort((a, b) => a.average - b.average);

  const rankings: RankedPlayer[] = playerStats.map((player, index) => ({
    ...player,
    rank: index + 1,
  }));

  return {
    totalGames: games.length,
    uniquePlayers: gamesByUser.size,
    rankings,
  };
}

export async function generateMonthlySummary(
  serverId: number,
  referenceDate: Date
): Promise<MonthlySummary> {
  const { start, end } = getLastMonth(referenceDate);
  const [games, users] = await Promise.all([
    repo.findGamesByServerAndDateRange(serverId, start, end),
    repo.findUsersByServer(serverId),
  ]);

  const userMap = buildUserMap(users);

  if (games.length === 0) {
    return {
      totalGames: 0,
      champion: null,
      bestScore: null,
      averageScore: null,
    };
  }

  const gamesByUser = new Map<number, Game[]>();
  for (const game of games) {
    const userGames = gamesByUser.get(game.userId) ?? [];
    userGames.push(game);
    gamesByUser.set(game.userId, userGames);
  }

  let champion: Champion | null = null;
  let bestChampionScore = Infinity;

  for (const [userId, userGames] of gamesByUser) {
    const user = userMap.get(userId);
    const winningGames = userGames.filter((g) => g.score !== Score.Fail);
    const average = winningGames.length > 0
      ? winningGames.reduce((sum, g) => sum + g.score, 0) / winningGames.length
      : Infinity;

    if (average < bestChampionScore) {
      bestChampionScore = average;
      champion = {
        userId,
        discordId: user?.discordId ?? '',
        wordleUsername: user?.wordleUsername ?? null,
        gamesPlayed: userGames.length,
        average,
      };
    }
  }

  const allScores = games.map((g) => g.score);
  const winningScores = allScores.filter((s) => s !== Score.Fail);
  const bestScore = winningScores.length > 0 ? Math.min(...winningScores) as Score : null;
  const averageScore = winningScores.length > 0
    ? winningScores.reduce((a, b) => a + b, 0) / winningScores.length
    : null;

  return {
    totalGames: games.length,
    champion,
    bestScore,
    averageScore,
  };
}
