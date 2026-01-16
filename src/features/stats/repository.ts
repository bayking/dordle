import { eq, and, desc, gte } from 'drizzle-orm';
import { getDb } from '@/db';
import { servers, users, games, type Server, type User, type Game } from '@/db/schema';

export async function findServerByDiscordId(discordId: string): Promise<Server | undefined> {
  const db = getDb();
  return db.query.servers.findFirst({
    where: eq(servers.discordId, discordId),
  });
}

export async function createServer(discordId: string): Promise<Server> {
  const db = getDb();
  const [created] = await db.insert(servers).values({ discordId }).returning();
  return created!;
}

export async function updateServer(
  serverId: number,
  updates: Partial<Pick<Server, 'wordleChannelId' | 'summaryChannelId' | 'timezone'>>
): Promise<void> {
  const db = getDb();
  await db.update(servers).set(updates).where(eq(servers.id, serverId));
}

export async function findUserByDiscordId(serverId: number, discordId: string): Promise<User | undefined> {
  const db = getDb();
  return db.query.users.findFirst({
    where: and(eq(users.serverId, serverId), eq(users.discordId, discordId)),
  });
}

export async function findUserByWordleUsername(serverId: number, wordleUsername: string): Promise<User | undefined> {
  const db = getDb();
  return db.query.users.findFirst({
    where: and(eq(users.serverId, serverId), eq(users.wordleUsername, wordleUsername)),
  });
}

export async function createUser(data: {
  serverId: number;
  discordId: string;
  wordleUsername?: string;
}): Promise<User> {
  const db = getDb();
  const [created] = await db.insert(users).values(data).returning();
  return created!;
}

export async function updateUserDiscordId(serverId: number, wordleUsername: string, discordId: string): Promise<void> {
  const db = getDb();
  await db
    .update(users)
    .set({ discordId })
    .where(and(eq(users.serverId, serverId), eq(users.wordleUsername, wordleUsername)));
}

export async function updateUserWordleUsername(serverId: number, discordId: string, wordleUsername: string): Promise<void> {
  const db = getDb();
  await db
    .update(users)
    .set({ wordleUsername })
    .where(and(eq(users.serverId, serverId), eq(users.discordId, discordId)));
}

export async function findGameByUserAndNumber(
  serverId: number,
  userId: number,
  wordleNumber: number
): Promise<Game | undefined> {
  const db = getDb();
  return db.query.games.findFirst({
    where: and(
      eq(games.serverId, serverId),
      eq(games.userId, userId),
      eq(games.wordleNumber, wordleNumber)
    ),
  });
}

export async function createGame(data: {
  serverId: number;
  userId: number;
  wordleNumber: number;
  score: number;
  messageId?: string;
  playedAt?: Date;
}): Promise<Game> {
  const db = getDb();
  const [created] = await db.insert(games).values(data).returning();
  return created!;
}

export async function findGamesByUserId(userId: number): Promise<Game[]> {
  const db = getDb();
  return db.query.games.findMany({
    where: eq(games.userId, userId),
    orderBy: games.playedAt,
  });
}

export async function findRecentGamesByUserId(userId: number, limit: number): Promise<Game[]> {
  const db = getDb();
  return db.query.games.findMany({
    where: eq(games.userId, userId),
    orderBy: desc(games.playedAt),
    limit,
  });
}

export async function findGamesByServerSince(serverId: number, since: Date): Promise<Game[]> {
  const db = getDb();
  return db.query.games.findMany({
    where: and(eq(games.serverId, serverId), gte(games.playedAt, since)),
    orderBy: games.playedAt,
  });
}

export async function findAllGamesByServer(serverId: number): Promise<Game[]> {
  const db = getDb();
  return db.query.games.findMany({
    where: eq(games.serverId, serverId),
    orderBy: games.playedAt,
  });
}

export async function findUsersByServer(serverId: number): Promise<User[]> {
  const db = getDb();
  return db.query.users.findMany({
    where: eq(users.serverId, serverId),
  });
}

export async function deleteServerStats(serverId: number): Promise<{ gamesDeleted: number; usersDeleted: number }> {
  const db = getDb();
  const deletedGames = await db.delete(games).where(eq(games.serverId, serverId)).returning();
  const deletedUsers = await db.delete(users).where(eq(users.serverId, serverId)).returning();
  return {
    gamesDeleted: deletedGames.length,
    usersDeleted: deletedUsers.length,
  };
}
