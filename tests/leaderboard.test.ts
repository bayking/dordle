import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { getLeaderboard, LeaderboardPeriod } from '@/features/leaderboard/service';
import * as repo from '@/features/leaderboard/repository';
import { Score } from '@/features/stats';
import type { Game, User } from '@/db/schema';

vi.mock('@/features/leaderboard/repository', () => ({
  findUsersByServer: vi.fn(),
  findGamesByServerAndPeriod: vi.fn(),
}));

const mockFindUsersByServer = repo.findUsersByServer as Mock;
const mockFindGamesByServerAndPeriod = repo.findGamesByServerAndPeriod as Mock;

// Test constants
const TEST_SERVER_ID = 1;
const BASE_WORDLE_NUMBER = 1000;

const USERS: User[] = [
  { id: 1, serverId: TEST_SERVER_ID, discordId: 'user1', wordleUsername: 'User1', createdAt: new Date(), elo: 1550, eloGamesPlayed: 10, lastPlayedAt: null },
  { id: 2, serverId: TEST_SERVER_ID, discordId: 'user2', wordleUsername: 'User2', createdAt: new Date(), elo: 1520, eloGamesPlayed: 10, lastPlayedAt: null },
  { id: 3, serverId: TEST_SERVER_ID, discordId: 'user3', wordleUsername: 'User3', createdAt: new Date(), elo: 1600, eloGamesPlayed: 10, lastPlayedAt: null }, // highest ELO = rank 1
  { id: 4, serverId: TEST_SERVER_ID, discordId: 'user4', wordleUsername: 'User4', createdAt: new Date(), elo: 1480, eloGamesPlayed: 10, lastPlayedAt: null },
  { id: 5, serverId: TEST_SERVER_ID, discordId: 'user5', wordleUsername: 'User5', createdAt: new Date(), elo: 1550, eloGamesPlayed: 10, lastPlayedAt: null }, // tied with user1
];

function createGames(userGames: { userId: number; scores: Score[] }[]): Game[] {
  const games: Game[] = [];
  let gameId = 1;

  for (const { userId, scores } of userGames) {
    for (let i = 0; i < scores.length; i++) {
      games.push({
        id: gameId++,
        serverId: TEST_SERVER_ID,
        userId,
        wordleNumber: BASE_WORDLE_NUMBER + i,
        score: scores[i]!,
        playedAt: new Date(Date.now() - (scores.length - i) * 86400000),
        messageId: null,
      });
    }
  }

  return games;
}

const GAME_DATA = {
  FIVE_USERS_VARIOUS_STATS: [
    { userId: 1, scores: [Score.Three, Score.Three, Score.Four] }, // avg 3.33
    { userId: 2, scores: [Score.Four, Score.Four, Score.Four] },   // avg 4.00
    { userId: 3, scores: [Score.Two, Score.Three, Score.Four] },   // avg 3.00 (best)
    { userId: 4, scores: [Score.Five, Score.Five, Score.Five] },   // avg 5.00
    { userId: 5, scores: [Score.Three, Score.Four, Score.Three] }, // avg 3.33 (tie with user1)
  ],
  USER_WITH_NO_GAMES_IN_PERIOD: [
    { userId: 1, scores: [Score.Three, Score.Three] },
    { userId: 2, scores: [Score.Four, Score.Four] },
    // userId 3 has no games
  ],
  STREAK_DATA: [
    { userId: 1, scores: [Score.Three, Score.Four, Score.Three] },           // currentStreak: 3, maxStreak: 3
    { userId: 2, scores: [Score.Three, Score.Fail, Score.Four, Score.Five] }, // currentStreak: 2, maxStreak: 2
    { userId: 3, scores: [Score.Fail, Score.Fail, Score.Three] },            // currentStreak: 1, maxStreak: 1
    { userId: 4, scores: [Score.Three, Score.Four, Score.Fail] },            // currentStreak: 0, maxStreak: 2
  ],
} as const;

const EXPECTED = {
  RANKED_BY_ELO: [
    { rank: 1, discordId: 'user3', elo: 1600, average: 3.0 },
    { rank: 2, discordId: 'user1', elo: 1550, average: 3.33 },
    { rank: 2, discordId: 'user5', elo: 1550, average: 3.33 }, // tied ELO
    { rank: 4, discordId: 'user2', elo: 1520, average: 4.0 },
    { rank: 5, discordId: 'user4', elo: 1480, average: 5.0 },
  ],
  STREAK_DATA: [
    { discordId: 'user1', currentStreak: 3, maxStreak: 3 },
    { discordId: 'user2', currentStreak: 2, maxStreak: 2 },
    { discordId: 'user3', currentStreak: 1, maxStreak: 1 },
    { discordId: 'user4', currentStreak: 0, maxStreak: 2 },
  ],
} as const;

describe('Leaderboard', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('Given 5 users with various stats', () => {
    it('When leaderboard generated, Then ranked by ELO with ties handled', async () => {
      mockFindUsersByServer.mockResolvedValue(USERS);
      mockFindGamesByServerAndPeriod.mockResolvedValue(
        createGames(GAME_DATA.FIVE_USERS_VARIOUS_STATS)
      );

      const leaderboard = await getLeaderboard(TEST_SERVER_ID, LeaderboardPeriod.AllTime);

      expect(leaderboard).toHaveLength(5);

      expect(leaderboard[0]!.rank).toBe(EXPECTED.RANKED_BY_ELO[0]!.rank);
      expect(leaderboard[0]!.discordId).toBe(EXPECTED.RANKED_BY_ELO[0]!.discordId);
      expect(leaderboard[0]!.elo).toBe(EXPECTED.RANKED_BY_ELO[0]!.elo);
      expect(leaderboard[0]!.average).toBeCloseTo(EXPECTED.RANKED_BY_ELO[0]!.average, 2);

      // Users 1 and 5 should be tied at rank 2 (same ELO)
      const rank2Users = leaderboard.filter((e) => e.rank === 2);
      expect(rank2Users).toHaveLength(2);
      expect(rank2Users.map((u) => u.discordId).sort()).toEqual(['user1', 'user5']);

      expect(leaderboard[3]!.rank).toBe(4);
      expect(leaderboard[4]!.rank).toBe(5);
    });
  });

  describe('Given period filter (weekly)', () => {
    it('When leaderboard generated, Then only includes games from that period', async () => {
      mockFindUsersByServer.mockResolvedValue(USERS.slice(0, 2));
      mockFindGamesByServerAndPeriod.mockResolvedValue(
        createGames(GAME_DATA.USER_WITH_NO_GAMES_IN_PERIOD)
      );

      const leaderboard = await getLeaderboard(TEST_SERVER_ID, LeaderboardPeriod.Weekly);

      expect(mockFindGamesByServerAndPeriod).toHaveBeenCalledWith(
        TEST_SERVER_ID,
        LeaderboardPeriod.Weekly
      );
      expect(leaderboard).toHaveLength(2);
    });
  });

  describe('Given user with no games in period', () => {
    it('When leaderboard generated, Then user is excluded', async () => {
      mockFindUsersByServer.mockResolvedValue(USERS.slice(0, 3));
      mockFindGamesByServerAndPeriod.mockResolvedValue(
        createGames(GAME_DATA.USER_WITH_NO_GAMES_IN_PERIOD)
      );

      const leaderboard = await getLeaderboard(TEST_SERVER_ID, LeaderboardPeriod.AllTime);

      expect(leaderboard).toHaveLength(2);
      expect(leaderboard.find((e) => e.discordId === 'user3')).toBeUndefined();
    });
  });

  describe('Given no users have played', () => {
    it('When leaderboard generated, Then returns empty array', async () => {
      mockFindUsersByServer.mockResolvedValue(USERS);
      mockFindGamesByServerAndPeriod.mockResolvedValue([]);

      const leaderboard = await getLeaderboard(TEST_SERVER_ID, LeaderboardPeriod.AllTime);

      expect(leaderboard).toHaveLength(0);
    });
  });

  describe('Given users with various streaks', () => {
    it('When leaderboard generated, Then includes current and max streak', async () => {
      mockFindUsersByServer.mockResolvedValue(USERS.slice(0, 4));
      mockFindGamesByServerAndPeriod.mockResolvedValue(
        createGames(GAME_DATA.STREAK_DATA)
      );

      const leaderboard = await getLeaderboard(TEST_SERVER_ID, LeaderboardPeriod.AllTime);

      for (const expected of EXPECTED.STREAK_DATA) {
        const entry = leaderboard.find((e) => e.discordId === expected.discordId);
        expect(entry).toBeDefined();
        expect(entry!.currentStreak).toBe(expected.currentStreak);
        expect(entry!.maxStreak).toBe(expected.maxStreak);
      }
    });
  });
});
