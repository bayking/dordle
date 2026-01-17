import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupTestDb, teardownTestDb } from './setup';
import { parseWordleMessage } from '@/features/parser/patterns';
import { getOrCreateServer, getOrCreateUser, recordGame, calculateUserStats, Score, deleteServerStats } from '@/features/stats';
import { getLeaderboard, LeaderboardPeriod } from '@/features/leaderboard';

// Test constants
const TEST_SERVER_DISCORD_ID = '123456789';

const DISCORD_IDS = {
  TEST_USER: '987654321',
  ALICE: 'alice123',
  BOB: 'bob456',
  CHARLIE: 'charlie789',
} as const;

const USERNAMES = {
  TEST_USER: 'TestUser',
  ALICE: 'Alice',
  BOB: 'Bob',
  CHARLIE: 'Charlie',
} as const;

const WORDLE_NUMBERS = {
  BASE: 1230,
  GAME_1: 1234,
  GAME_2: 1235,
} as const;

const WORDLE_MESSAGES = {
  SINGLE_PLAYER: `Your group is on a 5 day streak! 🔥 Here are yesterday's results:

🏆 3/6: @TestUser`,
  MULTI_PLAYER: `Your group is on a 10 day streak! 🔥 Here are yesterday's results:

🏆 2/6: @Alice
4/6: @Bob
5/6: @Charlie`,
  WITH_FAIL: `Your group is on a 3 day streak! 🔥 Here are yesterday's results:

🏆 3/6: @Winner
X/6: @Loser`,
} as const;

const EXPECTED_STATS = {
  SINGLE_GAME: {
    totalGames: 1,
    wins: 1,
    winRate: 100,
    average: 3,
  },
  FIVE_GAMES: {
    totalGames: 5,
    wins: 5,
    average: 3.4,
    currentStreak: 5,
    maxStreak: 5,
  },
  WITH_FAIL: {
    totalGames: 2,
    wins: 1,
    winRate: 50,
    average: 3,
  },
} as const;

const SCORE_SEQUENCES = {
  FIVE_WINS: [Score.Three, Score.Four, Score.Two, Score.Five, Score.Three],
} as const;

describe('Parser to Stats Integration', () => {
  beforeEach(() => {
    setupTestDb();
  });

  afterEach(() => {
    teardownTestDb();
  });

  it('Given a parsed Wordle message, When saved and stats calculated, Then stats reflect the game', async () => {
    const parsed = parseWordleMessage(WORDLE_MESSAGES.SINGLE_PLAYER);
    expect(parsed).not.toBeNull();

    const server = await getOrCreateServer(TEST_SERVER_DISCORD_ID);
    const user = await getOrCreateUser(server.id, DISCORD_IDS.TEST_USER, USERNAMES.TEST_USER);

    await recordGame({
      serverId: server.id,
      userId: user.id,
      wordleNumber: WORDLE_NUMBERS.GAME_1,
      score: parsed!.scores[0]!.score,
      messageId: 'msg123',
    });

    const stats = await calculateUserStats(user.id);

    expect(stats).not.toBeNull();
    expect(stats!.totalGames).toBe(EXPECTED_STATS.SINGLE_GAME.totalGames);
    expect(stats!.wins).toBe(EXPECTED_STATS.SINGLE_GAME.wins);
    expect(stats!.winRate).toBe(EXPECTED_STATS.SINGLE_GAME.winRate);
    expect(stats!.average).toBe(EXPECTED_STATS.SINGLE_GAME.average);
    expect(stats!.best).toBe(Score.Three);
    expect(stats!.distribution[Score.Three]).toBe(1);
  });

  it('Given multiple games saved, When stats calculated, Then stats aggregate correctly', async () => {
    const server = await getOrCreateServer(TEST_SERVER_DISCORD_ID);
    const user = await getOrCreateUser(server.id, DISCORD_IDS.TEST_USER, USERNAMES.TEST_USER);

    for (let i = 0; i < SCORE_SEQUENCES.FIVE_WINS.length; i++) {
      await recordGame({
        serverId: server.id,
        userId: user.id,
        wordleNumber: WORDLE_NUMBERS.BASE + i,
        score: SCORE_SEQUENCES.FIVE_WINS[i]!,
        messageId: `msg${i}`,
      });
    }

    const stats = await calculateUserStats(user.id);

    expect(stats!.totalGames).toBe(EXPECTED_STATS.FIVE_GAMES.totalGames);
    expect(stats!.wins).toBe(EXPECTED_STATS.FIVE_GAMES.wins);
    expect(stats!.average).toBe(EXPECTED_STATS.FIVE_GAMES.average);
    expect(stats!.best).toBe(Score.Two);
    expect(stats!.worst).toBe(Score.Five);
    expect(stats!.currentStreak).toBe(EXPECTED_STATS.FIVE_GAMES.currentStreak);
    expect(stats!.maxStreak).toBe(EXPECTED_STATS.FIVE_GAMES.maxStreak);
  });

  it('Given a fail game, When stats calculated, Then win rate and average reflect failure', async () => {
    const server = await getOrCreateServer(TEST_SERVER_DISCORD_ID);
    const user = await getOrCreateUser(server.id, DISCORD_IDS.TEST_USER, USERNAMES.TEST_USER);

    await recordGame({
      serverId: server.id,
      userId: user.id,
      wordleNumber: WORDLE_NUMBERS.GAME_1,
      score: Score.Three,
      messageId: 'msg1',
    });

    await recordGame({
      serverId: server.id,
      userId: user.id,
      wordleNumber: WORDLE_NUMBERS.GAME_2,
      score: Score.Fail,
      messageId: 'msg2',
    });

    const stats = await calculateUserStats(user.id);

    expect(stats!.totalGames).toBe(EXPECTED_STATS.WITH_FAIL.totalGames);
    expect(stats!.wins).toBe(EXPECTED_STATS.WITH_FAIL.wins);
    expect(stats!.winRate).toBe(EXPECTED_STATS.WITH_FAIL.winRate);
    expect(stats!.average).toBe(EXPECTED_STATS.WITH_FAIL.average);
    expect(stats!.worst).toBe(Score.Fail);
    expect(stats!.distribution[Score.Fail]).toBe(1);
  });

  it('Given duplicate game submission, When saved twice, Then only one game recorded', async () => {
    const server = await getOrCreateServer(TEST_SERVER_DISCORD_ID);
    const user = await getOrCreateUser(server.id, DISCORD_IDS.TEST_USER, USERNAMES.TEST_USER);

    await recordGame({
      serverId: server.id,
      userId: user.id,
      wordleNumber: WORDLE_NUMBERS.GAME_1,
      score: Score.Three,
      messageId: 'msg1',
    });

    await recordGame({
      serverId: server.id,
      userId: user.id,
      wordleNumber: WORDLE_NUMBERS.GAME_1,
      score: Score.Four,
      messageId: 'msg2',
    });

    const stats = await calculateUserStats(user.id);

    expect(stats!.totalGames).toBe(1);
    expect(stats!.distribution[Score.Three]).toBe(1);
  });
});

describe('Parser to Leaderboard Integration', () => {
  beforeEach(() => {
    setupTestDb();
  });

  afterEach(() => {
    teardownTestDb();
  });

  it('Given multiple users with games, When leaderboard generated, Then ranked by ELO with average as tiebreaker', async () => {
    const server = await getOrCreateServer(TEST_SERVER_DISCORD_ID);

    const alice = await getOrCreateUser(server.id, DISCORD_IDS.ALICE, USERNAMES.ALICE);
    const bob = await getOrCreateUser(server.id, DISCORD_IDS.BOB, USERNAMES.BOB);
    const charlie = await getOrCreateUser(server.id, DISCORD_IDS.CHARLIE, USERNAMES.CHARLIE);

    // Alice: avg 2.5
    await recordGame({ serverId: server.id, userId: alice.id, wordleNumber: WORDLE_NUMBERS.GAME_1, score: Score.Two, messageId: 'a1' });
    await recordGame({ serverId: server.id, userId: alice.id, wordleNumber: WORDLE_NUMBERS.GAME_2, score: Score.Three, messageId: 'a2' });

    // Bob: avg 4.0
    await recordGame({ serverId: server.id, userId: bob.id, wordleNumber: WORDLE_NUMBERS.GAME_1, score: Score.Four, messageId: 'b1' });
    await recordGame({ serverId: server.id, userId: bob.id, wordleNumber: WORDLE_NUMBERS.GAME_2, score: Score.Four, messageId: 'b2' });

    // Charlie: avg 3.0
    await recordGame({ serverId: server.id, userId: charlie.id, wordleNumber: WORDLE_NUMBERS.GAME_1, score: Score.Three, messageId: 'c1' });
    await recordGame({ serverId: server.id, userId: charlie.id, wordleNumber: WORDLE_NUMBERS.GAME_2, score: Score.Three, messageId: 'c2' });

    const leaderboard = await getLeaderboard(server.id, LeaderboardPeriod.AllTime);

    expect(leaderboard).toHaveLength(3);
    // All users have same ELO (1500), so all rank 1, sorted by average
    expect(leaderboard[0]!.discordId).toBe(DISCORD_IDS.ALICE);
    expect(leaderboard[0]!.rank).toBe(1);
    expect(leaderboard[0]!.average).toBe(2.5);
    expect(leaderboard[1]!.discordId).toBe(DISCORD_IDS.CHARLIE);
    expect(leaderboard[1]!.rank).toBe(1); // Same ELO = same rank
    expect(leaderboard[2]!.discordId).toBe(DISCORD_IDS.BOB);
    expect(leaderboard[2]!.rank).toBe(1); // Same ELO = same rank
  });

  it('Given users with tied averages, When leaderboard generated, Then same rank assigned', async () => {
    const server = await getOrCreateServer(TEST_SERVER_DISCORD_ID);

    const alice = await getOrCreateUser(server.id, DISCORD_IDS.ALICE, USERNAMES.ALICE);
    const bob = await getOrCreateUser(server.id, DISCORD_IDS.BOB, USERNAMES.BOB);

    await recordGame({ serverId: server.id, userId: alice.id, wordleNumber: WORDLE_NUMBERS.GAME_1, score: Score.Three, messageId: 'a1' });
    await recordGame({ serverId: server.id, userId: bob.id, wordleNumber: WORDLE_NUMBERS.GAME_1, score: Score.Three, messageId: 'b1' });

    const leaderboard = await getLeaderboard(server.id, LeaderboardPeriod.AllTime);

    expect(leaderboard).toHaveLength(2);
    expect(leaderboard[0]!.rank).toBe(1);
    expect(leaderboard[1]!.rank).toBe(1);
  });

  it('Given user with only fails, When leaderboard generated, Then has average of 7', async () => {
    const server = await getOrCreateServer(TEST_SERVER_DISCORD_ID);

    const alice = await getOrCreateUser(server.id, DISCORD_IDS.ALICE, USERNAMES.ALICE);
    const bob = await getOrCreateUser(server.id, DISCORD_IDS.BOB, USERNAMES.BOB);

    await recordGame({ serverId: server.id, userId: alice.id, wordleNumber: WORDLE_NUMBERS.GAME_1, score: Score.Three, messageId: 'a1' });
    await recordGame({ serverId: server.id, userId: bob.id, wordleNumber: WORDLE_NUMBERS.GAME_1, score: Score.Fail, messageId: 'b1' });

    const leaderboard = await getLeaderboard(server.id, LeaderboardPeriod.AllTime);

    expect(leaderboard).toHaveLength(2);
    // Same ELO, sorted by average (7 comes after 3)
    expect(leaderboard[0]!.discordId).toBe(DISCORD_IDS.ALICE);
    expect(leaderboard[0]!.average).toBe(3);
    expect(leaderboard[1]!.discordId).toBe(DISCORD_IDS.BOB);
    expect(leaderboard[1]!.average).toBe(7); // Fail = 7
  });
});

describe('Server Stats Reset Integration', () => {
  beforeEach(() => {
    setupTestDb();
  });

  afterEach(() => {
    teardownTestDb();
  });

  it('Given a server with games, When reset, Then all games and users deleted', async () => {
    const server = await getOrCreateServer(TEST_SERVER_DISCORD_ID);

    const alice = await getOrCreateUser(server.id, DISCORD_IDS.ALICE, USERNAMES.ALICE);
    const bob = await getOrCreateUser(server.id, DISCORD_IDS.BOB, USERNAMES.BOB);

    await recordGame({ serverId: server.id, userId: alice.id, wordleNumber: WORDLE_NUMBERS.GAME_1, score: Score.Three, messageId: 'a1' });
    await recordGame({ serverId: server.id, userId: alice.id, wordleNumber: WORDLE_NUMBERS.GAME_2, score: Score.Four, messageId: 'a2' });
    await recordGame({ serverId: server.id, userId: bob.id, wordleNumber: WORDLE_NUMBERS.GAME_1, score: Score.Five, messageId: 'b1' });

    const result = await deleteServerStats(server.id);

    expect(result.gamesDeleted).toBe(3);
    expect(result.usersDeleted).toBe(2);
  });

  it('Given a server with games, When reset, Then stats return null', async () => {
    const server = await getOrCreateServer(TEST_SERVER_DISCORD_ID);
    const user = await getOrCreateUser(server.id, DISCORD_IDS.ALICE, USERNAMES.ALICE);

    await recordGame({ serverId: server.id, userId: user.id, wordleNumber: WORDLE_NUMBERS.GAME_1, score: Score.Three, messageId: 'a1' });

    const statsBefore = await calculateUserStats(user.id);
    expect(statsBefore).not.toBeNull();

    await deleteServerStats(server.id);

    const statsAfter = await calculateUserStats(user.id);
    expect(statsAfter).toBeNull();
  });

  it('Given a server with games, When reset, Then leaderboard is empty', async () => {
    const server = await getOrCreateServer(TEST_SERVER_DISCORD_ID);
    const alice = await getOrCreateUser(server.id, DISCORD_IDS.ALICE, USERNAMES.ALICE);

    await recordGame({ serverId: server.id, userId: alice.id, wordleNumber: WORDLE_NUMBERS.GAME_1, score: Score.Three, messageId: 'a1' });

    const leaderboardBefore = await getLeaderboard(server.id, LeaderboardPeriod.AllTime);
    expect(leaderboardBefore).toHaveLength(1);

    await deleteServerStats(server.id);

    const leaderboardAfter = await getLeaderboard(server.id, LeaderboardPeriod.AllTime);
    expect(leaderboardAfter).toHaveLength(0);
  });

  it('Given an empty server, When reset, Then returns zero counts', async () => {
    const server = await getOrCreateServer(TEST_SERVER_DISCORD_ID);

    const result = await deleteServerStats(server.id);

    expect(result.gamesDeleted).toBe(0);
    expect(result.usersDeleted).toBe(0);
  });
});
