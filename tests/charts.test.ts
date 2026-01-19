import { describe, test, expect } from 'bun:test';
import {
  prepareLeaderboardChartData,
  type LeaderboardChartEntry,
  type EloDataPoint,
} from '@/features/charts/service';

const TEST_ENTRIES = {
  ALICE: {
    name: 'Alice',
    currentElo: 1550,
    eloHistory: [
      { wordleNumber: 1670, elo: 1500 },
      { wordleNumber: 1671, elo: 1520 },
      { wordleNumber: 1672, elo: 1550 },
    ],
  },
  BOB: {
    name: 'Bob',
    currentElo: 1480,
    eloHistory: [
      { wordleNumber: 1670, elo: 1500 },
      { wordleNumber: 1671, elo: 1490 },
      { wordleNumber: 1672, elo: 1480 },
    ],
  },
  CHARLIE_SPARSE: {
    name: 'Charlie',
    currentElo: 1510,
    eloHistory: [
      { wordleNumber: 1670, elo: 1500 },
      { wordleNumber: 1672, elo: 1510 }, // Skipped 1671
    ],
  },
  EMPTY_HISTORY: {
    name: 'Empty',
    currentElo: 1500,
    eloHistory: [],
  },
};

describe('prepareLeaderboardChartData', () => {
  describe('Given entries with ELO history', () => {
    test('Returns labels from wordle numbers', () => {
      const entries: LeaderboardChartEntry[] = [TEST_ENTRIES.ALICE, TEST_ENTRIES.BOB];

      const { labels } = prepareLeaderboardChartData(entries);

      expect(labels).toEqual(['#1670', '#1671', '#1672']);
    });

    test('Returns datasets with correct ELO values', () => {
      const entries: LeaderboardChartEntry[] = [TEST_ENTRIES.ALICE];

      const { datasets } = prepareLeaderboardChartData(entries);

      expect(datasets).toHaveLength(1);
      expect(datasets[0]!.label).toBe('Alice');
      expect(datasets[0]!.data).toEqual([1500, 1520, 1550]);
    });

    test('Returns null for missing wordle numbers when other players have data', () => {
      // Alice has all wordles, Charlie is missing 1671
      const entries: LeaderboardChartEntry[] = [TEST_ENTRIES.ALICE, TEST_ENTRIES.CHARLIE_SPARSE];

      const { labels, datasets } = prepareLeaderboardChartData(entries);

      // Labels include all wordles from both players
      expect(labels).toEqual(['#1670', '#1671', '#1672']);
      // Alice has all data
      expect(datasets[0]!.data).toEqual([1500, 1520, 1550]);
      // Charlie has null for 1671
      expect(datasets[1]!.data).toEqual([1500, null, 1510]);
    });
  });

  describe('Given entries with empty history', () => {
    test('Uses currentElo as single data point when no history', () => {
      const entries: LeaderboardChartEntry[] = [TEST_ENTRIES.EMPTY_HISTORY];

      const { labels, datasets } = prepareLeaderboardChartData(entries);

      expect(labels).toHaveLength(1);
      expect(labels[0]).toBe('Current');
      expect(datasets[0]!.data).toEqual([1500]);
    });

    test('Mixes historical and current-only entries', () => {
      const entries: LeaderboardChartEntry[] = [
        TEST_ENTRIES.ALICE,
        TEST_ENTRIES.EMPTY_HISTORY,
      ];

      const { labels, datasets } = prepareLeaderboardChartData(entries);

      // Labels from Alice's history
      expect(labels).toEqual(['#1670', '#1671', '#1672']);
      // Alice has full history
      expect(datasets[0]!.data).toEqual([1500, 1520, 1550]);
      // Empty has null for historical, but should show currentElo somehow
      // Actually, they just won't have data points for those wordles
      expect(datasets[1]!.data).toEqual([null, null, null]);
    });
  });

  describe('Given more than 7 wordle numbers', () => {
    test('Only shows last 7 wordles', () => {
      const manyWordles: EloDataPoint[] = [];
      for (let i = 1660; i <= 1675; i++) {
        manyWordles.push({ wordleNumber: i, elo: 1500 + i - 1660 });
      }
      const entries: LeaderboardChartEntry[] = [
        { name: 'Player', currentElo: 1515, eloHistory: manyWordles },
      ];

      const { labels } = prepareLeaderboardChartData(entries);

      expect(labels).toHaveLength(7);
      expect(labels[0]).toBe('#1669');
      expect(labels[6]).toBe('#1675');
    });
  });

  describe('Given no entries', () => {
    test('Returns empty labels and datasets', () => {
      const { labels, datasets } = prepareLeaderboardChartData([]);

      expect(labels).toEqual([]);
      expect(datasets).toEqual([]);
    });
  });

  describe('Given all entries have empty history', () => {
    test('Shows current ELO for all players', () => {
      const entries: LeaderboardChartEntry[] = [
        { name: 'Player1', currentElo: 1550, eloHistory: [] },
        { name: 'Player2', currentElo: 1480, eloHistory: [] },
      ];

      const { labels, datasets } = prepareLeaderboardChartData(entries);

      expect(labels).toEqual(['Current']);
      expect(datasets[0]!.data).toEqual([1550]);
      expect(datasets[1]!.data).toEqual([1480]);
    });
  });
});
