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

export async function findRecentGamesByServer(
  serverId: number,
  limit: number = 100
): Promise<Game[]> {
  const db = getDb();
  return db.query.games.findMany({
    where: eq(games.serverId, serverId),
    orderBy: desc(games.playedAt),
    limit,
  });
}
