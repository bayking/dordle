import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { calculateUserStats, Score } from '@/features/stats/service';
import * as repo from '@/features/stats/repository';
import type { Game } from '@/db/schema';

vi.mock('@/features/stats/repository', () => ({
  findGamesByUserId: vi.fn(),
}));

const mockFindGamesByUserId = repo.findGamesByUserId as Mock;

// Test constants
const TEST_USER_ID = 1;
const TEST_SERVER_ID = 1;
const BASE_WORDLE_NUMBER = 1000;

const SCORES = {
  MIXED_WITH_FAIL: [
    Score.Four, Score.Three, Score.Five, Score.Four, Score.Four,
    Score.Three, Score.Fail, Score.Four, Score.Three, Score.Four,
  ],
  ALL_WINS: [Score.Four, Score.Three, Score.Five, Score.Four, Score.Four],
  BROKEN_STREAK: [Score.Four, Score.Three, Score.Fail, Score.Four, Score.Four],
  MULTIPLE_STREAKS: [Score.Four, Score.Three, Score.Five, Score.Fail, Score.Four, Score.Four],
  FULL_DISTRIBUTION: [
    Score.One, Score.Two, Score.Three, Score.Three,
    Score.Four, Score.Four, Score.Four,
    Score.Five, Score.Six, Score.Fail,
  ],
  ALL_FAILURES: [Score.Fail, Score.Fail, Score.Fail],
} as const;

const EXPECTED = {
  MIXED_WITH_FAIL: {
    totalGames: 10,
    wins: 9,
    winRate: 90,
    average: 3.78,
    best: Score.Three,
    worst: Score.Fail,
  },
  ALL_WINS: {
    currentStreak: 5,
    maxStreak: 5,
  },
  BROKEN_STREAK: {
    currentStreak: 2,
    maxStreak: 2,
  },
  MULTIPLE_STREAKS: {
    currentStreak: 2,
    maxStreak: 3,
  },
  FULL_DISTRIBUTION: {
    [Score.One]: 1,
    [Score.Two]: 1,
    [Score.Three]: 2,
    [Score.Four]: 3,
    [Score.Five]: 1,
    [Score.Six]: 1,
    [Score.Fail]: 1,
  },
  ALL_FAILURES: {
    totalGames: 3,
    wins: 0,
    winRate: 0,
    average: null,
    currentStreak: 0,
  },
} as const;

function createMockGames(scores: readonly Score[]): Game[] {
  return scores.map((score, i) => ({
    id: i + 1,
    serverId: TEST_SERVER_ID,
    userId: TEST_USER_ID,
    wordleNumber: BASE_WORDLE_NUMBER + i,
    score,
    playedAt: new Date(Date.now() - (scores.length - i) * 86400000),
    messageId: null,
  }));
}

describe('Stats Calculations', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('Given a user with mixed results including a failure', () => {
    it('When stats calculated, Then returns correct win rate, average, best, and worst', async () => {
      mockFindGamesByUserId.mockResolvedValue(
        createMockGames(SCORES.MIXED_WITH_FAIL)
      );

      const stats = await calculateUserStats(TEST_USER_ID);

      expect(stats).not.toBeNull();
      expect(stats!.totalGames).toBe(EXPECTED.MIXED_WITH_FAIL.totalGames);
      expect(stats!.wins).toBe(EXPECTED.MIXED_WITH_FAIL.wins);
      expect(stats!.winRate).toBeCloseTo(EXPECTED.MIXED_WITH_FAIL.winRate, 0);
      expect(stats!.average).toBeCloseTo(EXPECTED.MIXED_WITH_FAIL.average, 2);
      expect(stats!.best).toBe(EXPECTED.MIXED_WITH_FAIL.best);
      expect(stats!.worst).toBe(EXPECTED.MIXED_WITH_FAIL.worst);
    });
  });

  describe('Given consecutive wins', () => {
    it('When streak calculated, Then current and max streak are correct', async () => {
      mockFindGamesByUserId.mockResolvedValue(
        createMockGames(SCORES.ALL_WINS)
      );

      const stats = await calculateUserStats(TEST_USER_ID);

      expect(stats).not.toBeNull();
      expect(stats!.currentStreak).toBe(EXPECTED.ALL_WINS.currentStreak);
      expect(stats!.maxStreak).toBe(EXPECTED.ALL_WINS.maxStreak);
    });

    it('When streak broken by failure, Then current streak resets', async () => {
      mockFindGamesByUserId.mockResolvedValue(
        createMockGames(SCORES.BROKEN_STREAK)
      );

      const stats = await calculateUserStats(TEST_USER_ID);

      expect(stats).not.toBeNull();
      expect(stats!.currentStreak).toBe(EXPECTED.BROKEN_STREAK.currentStreak);
      expect(stats!.maxStreak).toBe(EXPECTED.BROKEN_STREAK.maxStreak);
    });

    it('When multiple streaks exist, Then max streak is the highest', async () => {
      mockFindGamesByUserId.mockResolvedValue(
        createMockGames(SCORES.MULTIPLE_STREAKS)
      );

      const stats = await calculateUserStats(TEST_USER_ID);

      expect(stats).not.toBeNull();
      expect(stats!.currentStreak).toBe(EXPECTED.MULTIPLE_STREAKS.currentStreak);
      expect(stats!.maxStreak).toBe(EXPECTED.MULTIPLE_STREAKS.maxStreak);
    });
  });

  describe('Given full score distribution', () => {
    it('When distribution calculated, Then returns correct histogram', async () => {
      mockFindGamesByUserId.mockResolvedValue(
        createMockGames(SCORES.FULL_DISTRIBUTION)
      );

      const stats = await calculateUserStats(TEST_USER_ID);

      expect(stats).not.toBeNull();
      expect(stats!.distribution).toEqual(EXPECTED.FULL_DISTRIBUTION);
    });
  });

  describe('Given user with no games', () => {
    it('When stats calculated, Then returns null', async () => {
      mockFindGamesByUserId.mockResolvedValue([]);

      const stats = await calculateUserStats(TEST_USER_ID);

      expect(stats).toBeNull();
    });
  });

  describe('Given user with all failures', () => {
    it('When stats calculated, Then win rate is zero and average is null', async () => {
      mockFindGamesByUserId.mockResolvedValue(
        createMockGames(SCORES.ALL_FAILURES)
      );

      const stats = await calculateUserStats(TEST_USER_ID);

      expect(stats).not.toBeNull();
      expect(stats!.totalGames).toBe(EXPECTED.ALL_FAILURES.totalGames);
      expect(stats!.wins).toBe(EXPECTED.ALL_FAILURES.wins);
      expect(stats!.winRate).toBe(EXPECTED.ALL_FAILURES.winRate);
      expect(stats!.average).toBe(EXPECTED.ALL_FAILURES.average);
      expect(stats!.currentStreak).toBe(EXPECTED.ALL_FAILURES.currentStreak);
    });
  });
});
