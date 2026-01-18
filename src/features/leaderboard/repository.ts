import { eq, and, gte } from 'drizzle-orm';
import { getDb } from '@/db';
import { users, games, type User, type Game } from '@/db/schema';
import { LeaderboardPeriod } from '@/features/leaderboard/service';

export async function findUsersByServer(serverId: number): Promise<User[]> {
  const db = getDb();
  return db.query.users.findMany({
    where: eq(users.serverId, serverId),
  });
}

export async function findGamesByServerAndPeriod(
  serverId: number,
  period: LeaderboardPeriod
): Promise<Game[]> {
  const db = getDb();
  const since = getPeriodStart(period);

  if (since) {
    return db.query.games.findMany({
      where: and(eq(games.serverId, serverId), gte(games.playedAt, since)),
    });
  }

  return db.query.games.findMany({
    where: eq(games.serverId, serverId),
  });
}

function getPeriodStart(period: LeaderboardPeriod): Date | null {
  const now = new Date();

  switch (period) {
    case LeaderboardPeriod.Weekly: {
      const start = new Date(now);
      const day = start.getDay();
      const diff = start.getDate() - day + (day === 0 ? -6 : 1);
      start.setDate(diff);
      start.setHours(0, 0, 0, 0);
      // Subtract 1 day to account for playedAt backdate in parser
      start.setTime(start.getTime() - 86400000);
      return start;
    }
    case LeaderboardPeriod.Monthly: {
      const start = new Date(now);
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      // Subtract 1 day to account for playedAt backdate in parser
      start.setTime(start.getTime() - 86400000);
      return start;
    }
    case LeaderboardPeriod.AllTime:
    default:
      return null;
  }
}
