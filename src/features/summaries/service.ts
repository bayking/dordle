import { Score } from '@/features/stats';
import * as repo from '@/features/summaries/repository';
import { getEloChangesForWordle, getEloHistoryForDateRange } from '@/features/elo';
import type { Game, User, EloHistory } from '@/db/schema';

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
  eloChange?: number;
  newElo?: number;
}

export interface EloChange {
  userId: number;
  discordId: string;
  wordleUsername: string | null;
  oldElo: number;
  newElo: number;
  change: number;
}

export interface DailySummary {
  wordleNumber: number | null;
  participants: number;
  winner: PlayerScore | null;
  winners: PlayerScore[];
  scores: PlayerScore[];
  groupStreak: number;
  eloChanges: EloChange[];
}

export interface RankedPlayer {
  userId: number;
  discordId: string;
  wordleUsername: string | null;
  gamesPlayed: number;
  missedDays: number;
  average: number;
  rank: number;
  currentStreak: number;
  maxStreak: number;
  elo: number;
  eloGamesPlayed: number;
}

export interface EloMover {
  userId: number;
  discordId: string;
  wordleUsername: string | null;
  totalChange: number;
  startElo: number;
  endElo: number;
}

export interface WeeklySummary {
  totalGames: number;
  uniquePlayers: number;
  rankings: RankedPlayer[];
  topGainers: EloMover[];
  topLosers: EloMover[];
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
      eloChanges: [],
    };
  }

  const wordleNumber = games[0]!.wordleNumber;

  // Fetch ELO changes for this wordle
  const eloHistoryRecords = await getEloChangesForWordle(serverId, wordleNumber);
  const eloByUser = new Map<number, EloHistory>();
  for (const record of eloHistoryRecords) {
    eloByUser.set(record.userId, record);
  }

  const scores: PlayerScore[] = games.map((game) => {
    const user = userMap.get(game.userId);
    const eloRecord = eloByUser.get(game.userId);
    return {
      userId: game.userId,
      discordId: user?.discordId ?? '',
      wordleUsername: user?.wordleUsername ?? null,
      score: game.score,
      eloChange: eloRecord?.change,
      newElo: eloRecord?.newElo,
    };
  });

  const eloChanges: EloChange[] = eloHistoryRecords.map((record) => {
    const user = userMap.get(record.userId);
    return {
      userId: record.userId,
      discordId: user?.discordId ?? '',
      wordleUsername: user?.wordleUsername ?? null,
      oldElo: record.oldElo,
      newElo: record.newElo,
      change: record.change,
    };
  });

  // Sort by change descending (biggest gains first)
  eloChanges.sort((a, b) => b.change - a.change);

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
    eloChanges,
  };
}

export async function generateWeeklySummary(
  serverId: number,
  referenceDate: Date
): Promise<WeeklySummary> {
  const { start, end } = getLastWeek(referenceDate);
  const [games, users, eloHistory] = await Promise.all([
    repo.findGamesByServerAndDateRange(serverId, start, end),
    repo.findUsersByServer(serverId),
    getEloHistoryForDateRange(serverId, start, end),
  ]);

  const userMap = buildUserMap(users);

  if (games.length === 0) {
    return {
      totalGames: 0,
      uniquePlayers: 0,
      rankings: [],
      topGainers: [],
      topLosers: [],
    };
  }

  const gamesByUser = new Map<number, Game[]>();
  for (const game of games) {
    const userGames = gamesByUser.get(game.userId) ?? [];
    userGames.push(game);
    gamesByUser.set(game.userId, userGames);
  }

  // Find the range of wordles in this period
  const allWordleNumbers = games.map((g) => g.wordleNumber);
  const minWordle = Math.min(...allWordleNumbers);
  const maxWordle = Math.max(...allWordleNumbers);
  const totalWordlesInPeriod = maxWordle - minWordle + 1;

  const playerStats: Omit<RankedPlayer, 'rank'>[] = [];

  for (const [userId, userGames] of gamesByUser) {
    const user = userMap.get(userId);
    const winningGames = userGames.filter((g) => g.score !== Score.Fail);
    const average = winningGames.length > 0
      ? winningGames.reduce((sum, g) => sum + g.score, 0) / winningGames.length
      : Infinity;
    const { currentStreak, maxStreak } = calculateStreaks(userGames);

    // Calculate missed days (from player's first game in period to max wordle)
    const playerWordleNumbers = userGames.map((g) => g.wordleNumber);
    const playerMinWordle = Math.min(...playerWordleNumbers);
    const expectedGames = maxWordle - playerMinWordle + 1;
    const missedDays = expectedGames - userGames.length;

    playerStats.push({
      userId,
      discordId: user?.discordId ?? '',
      wordleUsername: user?.wordleUsername ?? null,
      gamesPlayed: userGames.length,
      missedDays,
      average,
      currentStreak,
      maxStreak,
      elo: user?.elo ?? 1500,
      eloGamesPlayed: user?.eloGamesPlayed ?? 0,
    });
  }

  // Sort by ELO (higher is better), then by average (lower is better)
  playerStats.sort((a, b) => {
    if (b.elo !== a.elo) return b.elo - a.elo;
    return a.average - b.average;
  });

  const rankings: RankedPlayer[] = playerStats.map((player, index) => ({
    ...player,
    rank: index + 1,
  }));

  // Calculate ELO movers from history
  const eloChangesPerUser = new Map<number, { total: number; first: number; last: number }>();
  for (const record of eloHistory) {
    const existing = eloChangesPerUser.get(record.userId);
    if (existing) {
      existing.total += record.change;
      existing.last = record.newElo;
    } else {
      eloChangesPerUser.set(record.userId, {
        total: record.change,
        first: record.oldElo,
        last: record.newElo,
      });
    }
  }

  const movers: EloMover[] = [];
  for (const [userId, changes] of eloChangesPerUser) {
    const user = userMap.get(userId);
    movers.push({
      userId,
      discordId: user?.discordId ?? '',
      wordleUsername: user?.wordleUsername ?? null,
      totalChange: changes.total,
      startElo: changes.first,
      endElo: changes.last,
    });
  }

  // Sort by total change
  const sortedByGain = [...movers].sort((a, b) => b.totalChange - a.totalChange);
  const topGainers = sortedByGain.filter((m) => m.totalChange > 0).slice(0, 3);
  const topLosers = sortedByGain.filter((m) => m.totalChange < 0).slice(-3).reverse();

  return {
    totalGames: games.length,
    uniquePlayers: gamesByUser.size,
    rankings,
    topGainers,
    topLosers,
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
