import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Score } from '@/features/stats';
import type { DailySummary, WeeklySummary, MonthlySummary } from '@/features/summaries';

// Test constants
const DISCORD_IDS = {
  ALICE: '111111111111111111',
  BOB: '222222222222222222',
  CHARLIE: '333333333333333333',
} as const;

const USERNAMES = {
  ALICE: 'alice',
  BOB: 'bob',
  CHARLIE: 'charlie',
} as const;

const WORDLE_NUMBER = 1234;

const mockClient = {
  users: {
    fetch: vi.fn().mockImplementation((id: string) => {
      const userMap: Record<string, { username: string }> = {
        [DISCORD_IDS.ALICE]: { username: USERNAMES.ALICE },
        [DISCORD_IDS.BOB]: { username: USERNAMES.BOB },
        [DISCORD_IDS.CHARLIE]: { username: USERNAMES.CHARLIE },
      };
      return Promise.resolve(userMap[id] ?? { username: id });
    }),
  },
} as any;

describe('Daily Summary Embed', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('Given daily summary with winner, When formatted, Then shows winner with score', async () => {
    const summary: DailySummary = {
      wordleNumber: WORDLE_NUMBER,
      participants: 3,
      winner: { userId: 1, discordId: DISCORD_IDS.ALICE, wordleUsername: USERNAMES.ALICE, score: Score.Three },
      winners: [{ userId: 1, discordId: DISCORD_IDS.ALICE, wordleUsername: USERNAMES.ALICE, score: Score.Three }],
      scores: [
        { userId: 1, discordId: DISCORD_IDS.ALICE, wordleUsername: USERNAMES.ALICE, score: Score.Three },
        { userId: 2, discordId: DISCORD_IDS.BOB, wordleUsername: USERNAMES.BOB, score: Score.Four },
        { userId: 3, discordId: DISCORD_IDS.CHARLIE, wordleUsername: USERNAMES.CHARLIE, score: Score.Five },
      ],
      groupStreak: 5,
      eloChanges: [],
    };

    const { formatDailySummaryEmbed } = await import('@/features/summaries/embeds');
    const embed = await formatDailySummaryEmbed(mockClient, summary);
    const description = embed.data.description!;

    expect(description).toContain('5 day streak');
    expect(description).toContain('Winner');
    expect(description).toContain('alice');
    expect(description).toContain('3/6');
    expect(embed.data.footer?.text).toContain('1234');
  });

  it('Given daily summary with no games, When formatted, Then shows no games message', async () => {
    const summary: DailySummary = {
      wordleNumber: null,
      participants: 0,
      winner: null,
      winners: [],
      scores: [],
      groupStreak: 0,
      eloChanges: [],
    };

    const { formatDailySummaryEmbed } = await import('@/features/summaries/embeds');
    const embed = await formatDailySummaryEmbed(mockClient, summary);

    expect(embed.data.description).toContain('No games played');
  });

  it('Given daily summary with multiple winners, When formatted, Then shows all winners', async () => {
    const summary: DailySummary = {
      wordleNumber: WORDLE_NUMBER,
      participants: 2,
      winner: { userId: 1, discordId: DISCORD_IDS.ALICE, wordleUsername: USERNAMES.ALICE, score: Score.Three },
      winners: [
        { userId: 1, discordId: DISCORD_IDS.ALICE, wordleUsername: USERNAMES.ALICE, score: Score.Three },
        { userId: 2, discordId: DISCORD_IDS.BOB, wordleUsername: USERNAMES.BOB, score: Score.Three },
      ],
      scores: [
        { userId: 1, discordId: DISCORD_IDS.ALICE, wordleUsername: USERNAMES.ALICE, score: Score.Three },
        { userId: 2, discordId: DISCORD_IDS.BOB, wordleUsername: USERNAMES.BOB, score: Score.Three },
      ],
      groupStreak: 2,
      eloChanges: [],
    };

    const { formatDailySummaryEmbed } = await import('@/features/summaries/embeds');
    const embed = await formatDailySummaryEmbed(mockClient, summary);
    const description = embed.data.description!;

    expect(description).toContain('Winners');
    expect(description).toContain('alice');
    expect(description).toContain('bob');
  });
});

describe('Weekly Summary Embed', () => {
  it('Given weekly summary with rankings, When formatted, Then shows leaderboard with medals', async () => {
    const summary: WeeklySummary = {
      totalGames: 15,
      uniquePlayers: 3,
      rankings: [
        { userId: 1, discordId: DISCORD_IDS.ALICE, wordleUsername: USERNAMES.ALICE, gamesPlayed: 5, average: 3.2, rank: 1, currentStreak: 5, maxStreak: 5, elo: 1600, eloGamesPlayed: 20 },
        { userId: 2, discordId: DISCORD_IDS.BOB, wordleUsername: USERNAMES.BOB, gamesPlayed: 5, average: 3.8, rank: 2, currentStreak: 3, maxStreak: 4, elo: 1550, eloGamesPlayed: 15 },
        { userId: 3, discordId: DISCORD_IDS.CHARLIE, wordleUsername: USERNAMES.CHARLIE, gamesPlayed: 5, average: 4.2, rank: 3, currentStreak: 0, maxStreak: 2, elo: 1480, eloGamesPlayed: 12 },
      ],
      topGainers: [],
      topLosers: [],
    };

    const { formatWeeklySummaryEmbed } = await import('@/features/summaries/embeds');
    const embed = await formatWeeklySummaryEmbed(mockClient, summary);
    const description = embed.data.description!;

    expect(description).toContain('15');
    expect(description).toContain('3 players');
    expect(description).toContain('🥇');
    expect(description).toContain('🥈');
    expect(description).toContain('🥉');
    expect(description).toContain('alice');
    expect(description).toContain('3.20 avg');
  });

  it('Given weekly summary with no games, When formatted, Then shows no games message', async () => {
    const summary: WeeklySummary = {
      totalGames: 0,
      uniquePlayers: 0,
      rankings: [],
      topGainers: [],
      topLosers: [],
    };

    const { formatWeeklySummaryEmbed } = await import('@/features/summaries/embeds');
    const embed = await formatWeeklySummaryEmbed(mockClient, summary);

    expect(embed.data.description).toContain('No games played');
  });
});

describe('Monthly Summary Embed', () => {
  it('Given monthly summary with champion, When formatted, Then shows champion and stats', async () => {
    const summary: MonthlySummary = {
      totalGames: 60,
      champion: {
        userId: 1,
        discordId: DISCORD_IDS.ALICE,
        wordleUsername: USERNAMES.ALICE,
        gamesPlayed: 20,
        average: 3.5,
      },
      rankings: [
        {
          userId: 1,
          discordId: DISCORD_IDS.ALICE,
          wordleUsername: USERNAMES.ALICE,
          gamesPlayed: 20,
          missedDays: 2,
          average: 3.5,
          rank: 1,
          currentStreak: 5,
          maxStreak: 10,
          elo: 1550,
          eloGamesPlayed: 20,
        },
      ],
      bestScore: Score.Two,
      averageScore: 4.1,
    };

    const { formatMonthlySummaryEmbed } = await import('@/features/summaries/embeds');
    const embed = await formatMonthlySummaryEmbed(mockClient, summary);
    const description = embed.data.description!;

    expect(description).toContain('60');
    expect(description).toContain('Champion');
    expect(description).toContain('alice');
    expect(description).toContain('3.50 avg');
    expect(description).toContain('Best Score');
    expect(description).toContain('2/6');
    expect(description).toContain('Server Average');
    expect(description).toContain('4.10');
  });

  it('Given monthly summary with no games, When formatted, Then shows no games message', async () => {
    const summary: MonthlySummary = {
      totalGames: 0,
      champion: null,
      rankings: [],
      bestScore: null,
      averageScore: null,
    };

    const { formatMonthlySummaryEmbed } = await import('@/features/summaries/embeds');
    const embed = await formatMonthlySummaryEmbed(mockClient, summary);

    expect(embed.data.description).toContain('No games played');
  });
});
