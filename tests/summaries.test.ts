import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import {
  generateDailySummary,
  generateWeeklySummary,
  generateMonthlySummary,
  SummaryPeriod,
  type DailySummary,
  type WeeklySummary,
  type MonthlySummary,
} from '@/features/summaries/service';
import * as repo from '@/features/summaries/repository';
import * as eloRepo from '@/features/elo';
import { Score } from '@/features/stats';
import type { Game, User } from '@/db/schema';

vi.mock('@/features/summaries/repository', () => ({
  findGamesByServerAndDateRange: vi.fn(),
  findUsersByServer: vi.fn(),
  getServerGroupStreak: vi.fn(),
}));

vi.mock('@/features/elo', () => ({
  getEloChangesForWordle: vi.fn(),
  getEloHistoryForDateRange: vi.fn(),
}));

const mockFindGamesByServerAndDateRange = repo.findGamesByServerAndDateRange as Mock;
const mockFindUsersByServer = repo.findUsersByServer as Mock;
const mockGetServerGroupStreak = repo.getServerGroupStreak as Mock;
const mockGetEloChangesForWordle = eloRepo.getEloChangesForWordle as Mock;
const mockGetEloHistoryForDateRange = eloRepo.getEloHistoryForDateRange as Mock;

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

describe('Summary Generation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Default ELO mocks - return empty arrays
    mockGetEloChangesForWordle.mockResolvedValue([]);
    mockGetEloHistoryForDateRange.mockResolvedValue([]);
  });

  describe('Daily Summary', () => {
    it('Given yesterday games, When daily summary generated, Then includes winner and all scores', async () => {
      const games = [
        createGame(USERS.ALICE.id, Score.Three, 1, 1000),
        createGame(USERS.BOB.id, Score.Four, 1, 1000),
        createGame(USERS.CHARLIE.id, Score.Five, 1, 1000),
      ];
      mockFindGamesByServerAndDateRange.mockResolvedValue(games);
      mockFindUsersByServer.mockResolvedValue(Object.values(USERS));
      mockGetServerGroupStreak.mockResolvedValue(5);

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

    it('Given tied scores, When daily summary generated, Then all winners included', async () => {
      const games = [
        createGame(USERS.ALICE.id, Score.Three, 1, 1000),
        createGame(USERS.BOB.id, Score.Three, 1, 1000),
        createGame(USERS.CHARLIE.id, Score.Five, 1, 1000),
      ];
      mockFindGamesByServerAndDateRange.mockResolvedValue(games);
      mockFindUsersByServer.mockResolvedValue(Object.values(USERS));
      mockGetServerGroupStreak.mockResolvedValue(3);

      const summary = await generateDailySummary(TEST_SERVER_ID, TEST_DATE);

      expect(summary.winners).toHaveLength(2);
      expect(summary.winners.map((w) => w.userId)).toContain(USERS.ALICE.id);
      expect(summary.winners.map((w) => w.userId)).toContain(USERS.BOB.id);
    });

    it('Given no games yesterday, When daily summary generated, Then returns empty summary', async () => {
      mockFindGamesByServerAndDateRange.mockResolvedValue([]);
      mockFindUsersByServer.mockResolvedValue(Object.values(USERS));
      mockGetServerGroupStreak.mockResolvedValue(0);

      const summary = await generateDailySummary(TEST_SERVER_ID, TEST_DATE);

      expect(summary.participants).toBe(0);
      expect(summary.winner).toBeNull();
      expect(summary.scores).toHaveLength(0);
    });

    it('Given game with fail, When daily summary generated, Then fail excluded from winner consideration', async () => {
      const games = [
        createGame(USERS.ALICE.id, Score.Fail, 1, 1000),
        createGame(USERS.BOB.id, Score.Five, 1, 1000),
      ];
      mockFindGamesByServerAndDateRange.mockResolvedValue(games);
      mockFindUsersByServer.mockResolvedValue(Object.values(USERS));
      mockGetServerGroupStreak.mockResolvedValue(1);

      const summary = await generateDailySummary(TEST_SERVER_ID, TEST_DATE);

      expect(summary.winner?.userId).toBe(USERS.BOB.id);
    });
  });

  describe('Weekly Summary', () => {
    it('Given week of games, When weekly summary generated, Then includes rankings', async () => {
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

    it('Given week of games, When weekly summary generated, Then calculates total games', async () => {
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

    it('Given no games in week, When weekly summary generated, Then returns empty rankings', async () => {
      mockFindGamesByServerAndDateRange.mockResolvedValue([]);
      mockFindUsersByServer.mockResolvedValue(Object.values(USERS));

      const summary = await generateWeeklySummary(TEST_SERVER_ID, TEST_DATE);

      expect(summary.rankings).toHaveLength(0);
      expect(summary.totalGames).toBe(0);
    });

    it('Given week of games with streaks, When weekly summary generated, Then includes streak data', async () => {
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
    it('Given month of games, When monthly summary generated, Then includes champion', async () => {
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

    it('Given month of games, When monthly summary generated, Then includes stats', async () => {
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
