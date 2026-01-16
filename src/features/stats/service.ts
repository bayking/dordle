import type { Server, User, Game } from '@/db/schema';
import * as repo from '@/features/stats/repository';

export enum Score {
  One = 1,
  Two = 2,
  Three = 3,
  Four = 4,
  Five = 5,
  Six = 6,
  Fail = 7,
}

export interface UserStats {
  totalGames: number;
  wins: number;
  winRate: number;
  average: number | null;
  best: Score;
  worst: Score;
  currentStreak: number;
  maxStreak: number;
  distribution: ScoreDistribution;
}

export type ScoreDistribution = Record<Score, number>;

function createEmptyDistribution(): ScoreDistribution {
  return {
    [Score.One]: 0,
    [Score.Two]: 0,
    [Score.Three]: 0,
    [Score.Four]: 0,
    [Score.Five]: 0,
    [Score.Six]: 0,
    [Score.Fail]: 0,
  };
}

export async function getOrCreateServer(discordId: string): Promise<Server> {
  const existing = await repo.findServerByDiscordId(discordId);
  if (existing) return existing;
  return repo.createServer(discordId);
}

export async function getOrCreateUser(
  serverId: number,
  discordId?: string,
  wordleUsername?: string
): Promise<User> {
  if (discordId) {
    const existing = await repo.findUserByDiscordId(serverId, discordId);
    if (existing) return existing;
  }

  if (wordleUsername) {
    const existing = await repo.findUserByWordleUsername(serverId, wordleUsername);
    if (existing) return existing;
  }

  return repo.createUser({
    serverId,
    discordId: discordId ?? `wordle:${wordleUsername}`,
    wordleUsername,
  });
}

export async function recordGame(data: {
  serverId: number;
  userId: number;
  score: Score;
  messageId?: string;
  wordleNumber?: number;
  playedAt?: Date;
}): Promise<Game | null> {
  const wordleNumber = data.wordleNumber ?? getWordleNumber(data.playedAt ?? new Date());

  const existing = await repo.findGameByUserAndNumber(data.serverId, data.userId, wordleNumber);
  if (existing) return null;

  return repo.createGame({
    serverId: data.serverId,
    userId: data.userId,
    wordleNumber,
    score: data.score,
    messageId: data.messageId,
    playedAt: data.playedAt,
  });
}

export async function getRecentGames(userId: number, limit: number): Promise<Game[]> {
  return repo.findRecentGamesByUserId(userId, limit);
}

export async function calculateUserStats(userId: number): Promise<UserStats | null> {
  const games = await repo.findGamesByUserId(userId);

  if (games.length === 0) return null;

  const wins = games.filter((g) => g.score !== Score.Fail);
  const winScores = wins.map((g) => g.score);

  const distribution = createEmptyDistribution();
  for (const game of games) {
    distribution[game.score as Score]++;
  }

  const { currentStreak, maxStreak } = calculateStreaks(games);

  return {
    totalGames: games.length,
    wins: wins.length,
    winRate: (wins.length / games.length) * 100,
    average: winScores.length > 0 ? winScores.reduce((a, b) => a + b, 0) / winScores.length : null,
    best: Math.min(...games.map((g) => g.score)) as Score,
    worst: Math.max(...games.map((g) => g.score)) as Score,
    currentStreak,
    maxStreak,
    distribution,
  };
}

function calculateStreaks(games: Game[]): { currentStreak: number; maxStreak: number } {
  let currentStreak = 0;
  let maxStreak = 0;
  let streak = 0;

  for (const game of games) {
    if (game.score !== Score.Fail) {
      streak++;
      maxStreak = Math.max(maxStreak, streak);
    } else {
      streak = 0;
    }
  }

  currentStreak = streak;
  return { currentStreak, maxStreak };
}

function getWordleNumber(date: Date): number {
  const wordleEpoch = new Date('2021-06-19T00:00:00Z');
  const diffDays = Math.floor((date.getTime() - wordleEpoch.getTime()) / 86400000);
  return diffDays + 1;
}
