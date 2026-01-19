import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { Score } from '@/features/stats';
import type { Game, User } from '@/db/schema';

// Create mocks
const mockFindGamesByServerAndDateRange = mock(() => Promise.resolve([]));
const mockFindUsersByServer = mock(() => Promise.resolve([]));
const mockFindRecentGamesByServer = mock(() => Promise.resolve([]));
const mockGetEloChangesForWordle = mock(() => Promise.resolve([]));
const mockGetEloHistoryForDateRange = mock(() => Promise.resolve([]));

// Mock modules before importing the service
mock.module('@/features/summaries/repository', () => ({
  findGamesByServerAndDateRange: mockFindGamesByServerAndDateRange,
  findUsersByServer: mockFindUsersByServer,
  findRecentGamesByServer: mockFindRecentGamesByServer,
}));

mock.module('@/features/elo', () => ({
  getEloChangesForWordle: mockGetEloChangesForWordle,
  getEloHistoryForDateRange: mockGetEloHistoryForDateRange,
  PROVISIONAL_GAMES: 10,
}));

// Import after mocking
const { generateDailySummary, generateWeeklySummary, generateMonthlySummary, calculateGroupStreak } =
  await import('@/features/summaries/service');

// Test constants
const TEST_SERVER_ID = 1;
const TEST_DATE = new Date('2024-01-15T12:00:00Z');

const USERS: Record<string, User> = {
  ALICE: {
    id: 1,
    serverId: TEST_SERVER_ID,
    discordId: '111',
    wordleUsername: 'Alice',
    createdAt: new Date(),
    elo: 1600,
    eloGamesPlayed: 20,
    lastPlayedAt: null,
  },
  BOB: {
    id: 2,
    serverId: TEST_SERVER_ID,
    discordId: '222',
    wordleUsername: 'Bob',
    createdAt: new Date(),
    elo: 1550,
    eloGamesPlayed: 15,
    lastPlayedAt: null,
  },
  CHARLIE: {
    id: 3,
    serverId: TEST_SERVER_ID,
    discordId: '333',
    wordleUsername: 'Charlie',
    createdAt: new Date(),
    elo: 1480,
    eloGamesPlayed: 12,
    lastPlayedAt: null,
  },
};

function createGame(
  userId: number,
  score: Score,
  daysAgo: number,
  wordleNumber: number
): Game {
  return {
    id: wordleNumber,
    serverId: TEST_SERVER_ID,
    userId,
    wordleNumber,
    score,
    playedAt: new Date(TEST_DATE.getTime() - daysAgo * 86400000),
    messageId: null,
  };
}

// Helper to create games that produce a specific streak count
function createStreakGames(streakCount: number, startingWordle: number = 1000): Game[] {
  const games: Game[] = [];
  for (let i = 0; i < streakCount; i++) {
    games.push(createGame(USERS.ALICE.id, Score.Four, i, startingWordle - i));
  }
  return games;
}

describe('Group Streak Calculation', () => {
  test('Given consecutive wordle numbers, When calculating streak, Then counts all days', () => {
    // Games for wordles 1000, 999, 998 (all consecutive)
    const games = [
      createGame(USERS.ALICE.id, Score.Four, 0, 1000),
      createGame(USERS.BOB.id, Score.Three, 0, 1000),
      createGame(USERS.ALICE.id, Score.Four, 1, 999),
      createGame(USERS.ALICE.id, Score.Four, 2, 998),
    ];

    const streak = calculateGroupStreak(games);

    expect(streak).toBe(3);
  });

  test('Given gap in wordle numbers, When calculating streak, Then stops at gap', () => {
    // Games for wordles 1000, 999, 997 (gap at 998)
    const games = [
      createGame(USERS.ALICE.id, Score.Four, 0, 1000),
      createGame(USERS.ALICE.id, Score.Four, 1, 999),
      createGame(USERS.ALICE.id, Score.Four, 3, 997), // Skipped 998
    ];

    const streak = calculateGroupStreak(games);

    expect(streak).toBe(2); // Only 1000 and 999, stops before gap
  });

  test('Given no games, When calculating streak, Then returns 0', () => {
    const streak = calculateGroupStreak([]);

    expect(streak).toBe(0);
  });

  test('Given single wordle, When calculating streak, Then returns 1', () => {
    const games = [
      createGame(USERS.ALICE.id, Score.Four, 0, 1000),
      createGame(USERS.BOB.id, Score.Three, 0, 1000),
    ];

    const streak = calculateGroupStreak(games);

    expect(streak).toBe(1);
  });
});

describe('Summary Generation', () => {
  beforeEach(() => {
    mockFindGamesByServerAndDateRange.mockClear();
    mockFindUsersByServer.mockClear();
    mockFindRecentGamesByServer.mockClear();
    mockGetEloChangesForWordle.mockClear();
    mockGetEloHistoryForDateRange.mockClear();

    // Default mocks
    mockFindRecentGamesByServer.mockResolvedValue([]);
    mockGetEloChangesForWordle.mockResolvedValue([]);
    mockGetEloHistoryForDateRange.mockResolvedValue([]);
  });

  describe('Daily Summary', () => {
    test('Given yesterday games, When daily summary generated, Then includes winner and all scores', async () => {
      const games = [
        createGame(USERS.ALICE.id, Score.Three, 1, 1000),
        createGame(USERS.BOB.id, Score.Four, 1, 1000),
        createGame(USERS.CHARLIE.id, Score.Five, 1, 1000),
      ];
      mockFindGamesByServerAndDateRange.mockResolvedValue(games);
      mockFindUsersByServer.mockResolvedValue(Object.values(USERS));
      mockFindRecentGamesByServer.mockResolvedValue(createStreakGames(5));

      const summary = await generateDailySummary(TEST_SERVER_ID, TEST_DATE);

      expect(summary.wordleNumber).toBe(1000);
      expect(summary.participants).toBe(3);
      expect(summary.winner?.userId).toBe(USERS.ALICE.id);
      expect(summary.winner?.discordId).toBe(USERS.ALICE.discordId);
      expect(summary.winner?.wordleUsername).toBe(USERS.ALICE.wordleUsername);
      expect(summary.winner?.score).toBe(Score.Three);
      expect(summary.groupStreak).toBe(5);
      expect(summary.scores).toHaveLength(3);
    });

    test('Given tied scores, When daily summary generated, Then all winners included', async () => {
      const games = [
        createGame(USERS.ALICE.id, Score.Three, 1, 1000),
        createGame(USERS.BOB.id, Score.Three, 1, 1000),
        createGame(USERS.CHARLIE.id, Score.Five, 1, 1000),
      ];
      mockFindGamesByServerAndDateRange.mockResolvedValue(games);
      mockFindUsersByServer.mockResolvedValue(Object.values(USERS));
      mockFindRecentGamesByServer.mockResolvedValue(createStreakGames(3));

      const summary = await generateDailySummary(TEST_SERVER_ID, TEST_DATE);

      expect(summary.winners).toHaveLength(2);
      expect(summary.winners.map((w) => w.userId)).toContain(USERS.ALICE.id);
      expect(summary.winners.map((w) => w.userId)).toContain(USERS.BOB.id);
    });

    test('Given no games yesterday, When daily summary generated, Then returns empty summary', async () => {
      mockFindGamesByServerAndDateRange.mockResolvedValue([]);
      mockFindUsersByServer.mockResolvedValue(Object.values(USERS));
      mockFindRecentGamesByServer.mockResolvedValue([]);

      const summary = await generateDailySummary(TEST_SERVER_ID, TEST_DATE);

      expect(summary.participants).toBe(0);
      expect(summary.winner).toBeNull();
      expect(summary.scores).toHaveLength(0);
    });

    test('Given game with fail, When daily summary generated, Then fail excluded from winner consideration', async () => {
      const games = [
        createGame(USERS.ALICE.id, Score.Fail, 1, 1000),
        createGame(USERS.BOB.id, Score.Five, 1, 1000),
      ];
      mockFindGamesByServerAndDateRange.mockResolvedValue(games);
      mockFindUsersByServer.mockResolvedValue(Object.values(USERS));
      mockFindRecentGamesByServer.mockResolvedValue(createStreakGames(1));

      const summary = await generateDailySummary(TEST_SERVER_ID, TEST_DATE);

      expect(summary.winner?.userId).toBe(USERS.BOB.id);
    });

    test('Given games from multiple wordles in date range, When daily summary generated, Then only most recent wordle games included', async () => {
      // This simulates the 2-day date range capturing games from both yesterday and day before
      // Games are returned DESC by playedAt, so newest (wordle 1001) comes first
      const games = [
        // Day 8 games (Wordle 1001) - most recent, should be used
        createGame(USERS.ALICE.id, Score.Five, 1, 1001),  // Alice got 5/6 on day 8
        createGame(USERS.BOB.id, Score.Six, 1, 1001),     // Bob got 6/6 on day 8
        // Day 7 games (Wordle 1000) - older, should be excluded
        createGame(USERS.ALICE.id, Score.Four, 2, 1000),  // Alice got 4/6 on day 7
        createGame(USERS.BOB.id, Score.Fail, 2, 1000),    // Bob got X/6 on day 7
      ];
      mockFindGamesByServerAndDateRange.mockResolvedValue(games);
      mockFindUsersByServer.mockResolvedValue(Object.values(USERS));
      mockFindRecentGamesByServer.mockResolvedValue(createStreakGames(8));

      const summary = await generateDailySummary(TEST_SERVER_ID, TEST_DATE);

      // Should use Wordle 1001 (most recent)
      expect(summary.wordleNumber).toBe(1001);
      // Should only have 2 participants (day 8 games only)
      expect(summary.participants).toBe(2);
      // Winner should be Alice with 5/6 (not 4/6 from day 7)
      expect(summary.winner?.userId).toBe(USERS.ALICE.id);
      expect(summary.winner?.score).toBe(Score.Five);
      // Bob should have 6/6 (not X/6 from day 7)
      const bobScore = summary.scores.find(s => s.userId === USERS.BOB.id);
      expect(bobScore?.score).toBe(Score.Six);
    });
  });

  describe('Weekly Summary', () => {
    test('Given reference date, When weekly summary generated, Then queries 7 days ending on reference date', async () => {
      mockFindGamesByServerAndDateRange.mockResolvedValue([]);
      mockFindUsersByServer.mockResolvedValue([]);

      await generateWeeklySummary(TEST_SERVER_ID, TEST_DATE);

      const calls = mockFindGamesByServerAndDateRange.mock.calls;
      const [, start, end] = calls[0] as [number, Date, Date];
      // End should be reference date (Jan 15), not yesterday
      expect(end.toISOString()).toContain('2024-01-15');
      // Start should be 6 days before (Jan 9)
      expect(start.toISOString()).toContain('2024-01-09');
    });

    test('Given week of games, When weekly summary generated, Then includes rankings', async () => {
      const games = [
        // Alice: avg 3.0
        createGame(USERS.ALICE.id, Score.Three, 1, 1006),
        createGame(USERS.ALICE.id, Score.Three, 2, 1005),
        createGame(USERS.ALICE.id, Score.Three, 3, 1004),
        // Bob: avg 4.0
        createGame(USERS.BOB.id, Score.Four, 1, 1006),
        createGame(USERS.BOB.id, Score.Four, 2, 1005),
        createGame(USERS.BOB.id, Score.Four, 3, 1004),
        // Charlie: avg 5.0
        createGame(USERS.CHARLIE.id, Score.Five, 1, 1006),
        createGame(USERS.CHARLIE.id, Score.Five, 2, 1005),
        createGame(USERS.CHARLIE.id, Score.Five, 3, 1004),
      ];
      mockFindGamesByServerAndDateRange.mockResolvedValue(games);
      mockFindUsersByServer.mockResolvedValue(Object.values(USERS));

      const summary = await generateWeeklySummary(TEST_SERVER_ID, TEST_DATE);

      expect(summary.rankings).toHaveLength(3);
      expect(summary.rankings[0]?.userId).toBe(USERS.ALICE.id);
      expect(summary.rankings[0]?.average).toBe(3);
      expect(summary.rankings[1]?.userId).toBe(USERS.BOB.id);
      expect(summary.rankings[2]?.userId).toBe(USERS.CHARLIE.id);
    });

    test('Given week of games, When weekly summary generated, Then calculates total games', async () => {
      const games = [
        createGame(USERS.ALICE.id, Score.Three, 1, 1006),
        createGame(USERS.ALICE.id, Score.Four, 2, 1005),
        createGame(USERS.BOB.id, Score.Five, 1, 1006),
      ];
      mockFindGamesByServerAndDateRange.mockResolvedValue(games);
      mockFindUsersByServer.mockResolvedValue(Object.values(USERS));

      const summary = await generateWeeklySummary(TEST_SERVER_ID, TEST_DATE);

      expect(summary.totalGames).toBe(3);
      expect(summary.uniquePlayers).toBe(2);
    });

    test('Given no games in week, When weekly summary generated, Then returns empty rankings', async () => {
      mockFindGamesByServerAndDateRange.mockResolvedValue([]);
      mockFindUsersByServer.mockResolvedValue(Object.values(USERS));

      const summary = await generateWeeklySummary(TEST_SERVER_ID, TEST_DATE);

      expect(summary.rankings).toHaveLength(0);
      expect(summary.totalGames).toBe(0);
    });

    test('Given week of games with streaks, When weekly summary generated, Then includes streak data', async () => {
      const games = [
        // Alice: 3 consecutive wins = currentStreak 3, maxStreak 3
        createGame(USERS.ALICE.id, Score.Three, 1, 1006),
        createGame(USERS.ALICE.id, Score.Three, 2, 1005),
        createGame(USERS.ALICE.id, Score.Three, 3, 1004),
        // Bob: fail breaks streak = currentStreak 1, maxStreak 2
        createGame(USERS.BOB.id, Score.Four, 1, 1006),
        createGame(USERS.BOB.id, Score.Fail, 2, 1005),
        createGame(USERS.BOB.id, Score.Four, 3, 1004),
        createGame(USERS.BOB.id, Score.Four, 4, 1003),
      ];
      mockFindGamesByServerAndDateRange.mockResolvedValue(games);
      mockFindUsersByServer.mockResolvedValue(Object.values(USERS));

      const summary = await generateWeeklySummary(TEST_SERVER_ID, TEST_DATE);

      const alice = summary.rankings.find((r) => r.userId === USERS.ALICE.id);
      const bob = summary.rankings.find((r) => r.userId === USERS.BOB.id);

      expect(alice?.currentStreak).toBe(3);
      expect(alice?.maxStreak).toBe(3);
      expect(bob?.currentStreak).toBe(1);
      expect(bob?.maxStreak).toBe(2);
    });
  });

  describe('Monthly Summary', () => {
    test('Given reference date, When monthly summary generated, Then queries 1 month ending on reference date', async () => {
      mockFindGamesByServerAndDateRange.mockResolvedValue([]);
      mockFindUsersByServer.mockResolvedValue([]);

      await generateMonthlySummary(TEST_SERVER_ID, TEST_DATE);

      const calls = mockFindGamesByServerAndDateRange.mock.calls;
      const [, start, end] = calls[0] as [number, Date, Date];
      // End should be reference date (Jan 15), not yesterday
      expect(end.toISOString()).toContain('2024-01-15');
      // Start should be 1 month before (Dec 15)
      expect(start.toISOString()).toContain('2023-12-15');
    });

    test('Given month of games, When monthly summary generated, Then includes champion', async () => {
      const games = [
        // Alice plays more with better average
        createGame(USERS.ALICE.id, Score.Three, 1, 1030),
        createGame(USERS.ALICE.id, Score.Three, 5, 1026),
        createGame(USERS.ALICE.id, Score.Three, 10, 1021),
        createGame(USERS.ALICE.id, Score.Three, 15, 1016),
        // Bob plays less
        createGame(USERS.BOB.id, Score.Four, 1, 1030),
        createGame(USERS.BOB.id, Score.Four, 5, 1026),
      ];
      mockFindGamesByServerAndDateRange.mockResolvedValue(games);
      mockFindUsersByServer.mockResolvedValue(Object.values(USERS));

      const summary = await generateMonthlySummary(TEST_SERVER_ID, TEST_DATE);

      expect(summary.champion?.userId).toBe(USERS.ALICE.id);
      expect(summary.champion?.gamesPlayed).toBe(4);
      expect(summary.champion?.average).toBe(3);
    });

    test('Given month of games, When monthly summary generated, Then includes stats', async () => {
      const games = [
        createGame(USERS.ALICE.id, Score.One, 1, 1030),
        createGame(USERS.ALICE.id, Score.Six, 5, 1026),
        createGame(USERS.BOB.id, Score.Three, 1, 1030),
      ];
      mockFindGamesByServerAndDateRange.mockResolvedValue(games);
      mockFindUsersByServer.mockResolvedValue(Object.values(USERS));

      const summary = await generateMonthlySummary(TEST_SERVER_ID, TEST_DATE);

      expect(summary.totalGames).toBe(3);
      expect(summary.bestScore).toBe(Score.One);
      expect(summary.averageScore).toBeCloseTo(3.33, 1);
    });
  });
});
