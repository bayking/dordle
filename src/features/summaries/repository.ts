import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { getDb } from '@/db';
import { games, users, type Game, type User } from '@/db/schema';

export async function findGamesByServerAndDateRange(
  serverId: number,
  startDate: Date,
  endDate: Date
): Promise<Game[]> {
  const db = getDb();
  return db.query.games.findMany({
    where: and(
      eq(games.serverId, serverId),
      gte(games.playedAt, startDate),
      lte(games.playedAt, endDate)
    ),
    orderBy: desc(games.playedAt),
  });
}

export async function findUsersByServer(serverId: number): Promise<User[]> {
  const db = getDb();
  return db.query.users.findMany({
    where: eq(users.serverId, serverId),
  });
}

export async function getServerGroupStreak(serverId: number): Promise<number> {
  const db = getDb();
  const recentGames = await db.query.games.findMany({
    where: eq(games.serverId, serverId),
    orderBy: desc(games.playedAt),
    limit: 100,
  });

  if (recentGames.length === 0) return 0;

  const gamesByWordle = new Map<number, Game[]>();
  for (const game of recentGames) {
    const wordleGames = gamesByWordle.get(game.wordleNumber) ?? [];
    wordleGames.push(game);
    gamesByWordle.set(game.wordleNumber, wordleGames);
  }

  const wordleNumbers = [...gamesByWordle.keys()].sort((a, b) => b - a);
  let streak = 0;

  for (const wordleNumber of wordleNumbers) {
    const wordleGames = gamesByWordle.get(wordleNumber)!;
    const hasParticipation = wordleGames.length > 0;

    if (hasParticipation) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}
