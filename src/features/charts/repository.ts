import { eq, desc } from 'drizzle-orm';
import { getDb } from '@/db';
import { games, type Game } from '@/db/schema';

const TREND_GAME_LIMIT = 30;

export async function findRecentGamesByUserId(userId: number): Promise<Game[]> {
  const db = getDb();
  return db.query.games.findMany({
    where: eq(games.userId, userId),
    orderBy: desc(games.playedAt),
    limit: TREND_GAME_LIMIT,
  });
}
