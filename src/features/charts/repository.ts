import { eq, desc, and, inArray, gte } from 'drizzle-orm';
import { getDb } from '@/db';
import { games, eloHistory, type Game } from '@/db/schema';
import type { EloDataPoint } from '@/features/charts/service';

const TREND_GAME_LIMIT = 30;
const ELO_HISTORY_DAYS = 7;

export async function findRecentGamesByUserId(userId: number): Promise<Game[]> {
  const db = getDb();
  return db.query.games.findMany({
    where: eq(games.userId, userId),
    orderBy: desc(games.playedAt),
    limit: TREND_GAME_LIMIT,
  });
}

export async function findEloHistoryForUsers(
  serverId: number,
  userIds: number[]
): Promise<Map<number, EloDataPoint[]>> {
  if (userIds.length === 0) {
    return new Map();
  }

  const db = getDb();

  // Get ELO history for the last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - ELO_HISTORY_DAYS);

  const history = await db.query.eloHistory.findMany({
    where: and(
      eq(eloHistory.serverId, serverId),
      inArray(eloHistory.userId, userIds),
      gte(eloHistory.createdAt, sevenDaysAgo)
    ),
    orderBy: (h, { asc }) => asc(h.wordleNumber),
  });

  // Group by user
  const result = new Map<number, EloDataPoint[]>();
  for (const userId of userIds) {
    result.set(userId, []);
  }

  for (const h of history) {
    const userHistory = result.get(h.userId);
    if (userHistory) {
      userHistory.push({
        wordleNumber: h.wordleNumber,
        elo: h.newElo,
      });
    }
  }

  return result;
}
