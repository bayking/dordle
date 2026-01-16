import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { generateDistributionChart, generateTrendChart } from '@/features/charts/service';
import * as repo from '@/features/charts/repository';
import { Score, type ScoreDistribution } from '@/features/stats';
import type { Game } from '@/db/schema';

vi.mock('@/features/charts/repository', () => ({
  findRecentGamesByUserId: vi.fn(),
}));

const mockFindRecentGamesByUserId = repo.findRecentGamesByUserId as Mock;

// Test constants
const TEST_USER_ID = 1;
const TEST_USERNAME = 'TestUser';
const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

const DISTRIBUTIONS: Record<string, ScoreDistribution> = {
  NORMAL: {
    [Score.One]: 2,
    [Score.Two]: 5,
    [Score.Three]: 15,
    [Score.Four]: 25,
    [Score.Five]: 10,
    [Score.Six]: 3,
    [Score.Fail]: 1,
  },
  EMPTY: {
    [Score.One]: 0,
    [Score.Two]: 0,
    [Score.Three]: 0,
    [Score.Four]: 0,
    [Score.Five]: 0,
    [Score.Six]: 0,
    [Score.Fail]: 0,
  },
};

function createTrendGames(scores: Score[]): Game[] {
  return scores.map((score, i) => ({
    id: i + 1,
    serverId: 1,
    userId: TEST_USER_ID,
    wordleNumber: 1000 + i,
    score,
    playedAt: new Date(Date.now() - (scores.length - i) * 86400000),
    messageId: null,
  }));
}

describe('Chart Generation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('Distribution Chart', () => {
    it('Given valid distribution, When chart generated, Then returns valid PNG buffer', async () => {
      const buffer = await generateDistributionChart(DISTRIBUTIONS.NORMAL, TEST_USERNAME);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
      expect(buffer.subarray(0, 4).equals(PNG_HEADER)).toBe(true);
    });

    it('Given empty distribution, When chart generated, Then still returns valid PNG', async () => {
      const buffer = await generateDistributionChart(DISTRIBUTIONS.EMPTY, TEST_USERNAME);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.subarray(0, 4).equals(PNG_HEADER)).toBe(true);
    });
  });

  describe('Trend Chart', () => {
    it('Given user with games, When trend chart generated, Then returns valid PNG buffer', async () => {
      const games = createTrendGames([
        Score.Four, Score.Three, Score.Five, Score.Four,
        Score.Three, Score.Four, Score.Three, Score.Four,
      ]);
      mockFindRecentGamesByUserId.mockResolvedValue(games);

      const buffer = await generateTrendChart(TEST_USER_ID, TEST_USERNAME);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
      expect(buffer.subarray(0, 4).equals(PNG_HEADER)).toBe(true);
    });

    it('Given user with no games, When trend chart generated, Then returns valid PNG', async () => {
      mockFindRecentGamesByUserId.mockResolvedValue([]);

      const buffer = await generateTrendChart(TEST_USER_ID, TEST_USERNAME);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.subarray(0, 4).equals(PNG_HEADER)).toBe(true);
    });
  });
});
