import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { EmbedBuilder } from 'discord.js';
import { Score } from '@/features/stats';
import type { Game, User } from '@/db/schema';

// Mock at repository level - the actual dependencies
const mockFindGamesByServerAndDateRange = mock(() => Promise.resolve([]));
const mockFindUsersByServer = mock(() => Promise.resolve([]));
const mockGetServerGroupStreak = mock(() => Promise.resolve(0));
const mockGetEloChangesForWordle = mock(() => Promise.resolve([]));
const mockGetEloHistoryForDateRange = mock(() => Promise.resolve([]));
const mockGetOrCreateServer = mock(() => Promise.resolve({ id: 1, discordId: '123', timezone: 'UTC', summaryChannelId: null, createdAt: new Date() }));

// Mock modules at the lowest level
mock.module('@/features/summaries/repository', () => ({
  findGamesByServerAndDateRange: mockFindGamesByServerAndDateRange,
  findUsersByServer: mockFindUsersByServer,
  getServerGroupStreak: mockGetServerGroupStreak,
}));

mock.module('@/features/elo', () => ({
  getEloChangesForWordle: mockGetEloChangesForWordle,
  getEloHistoryForDateRange: mockGetEloHistoryForDateRange,
  PROVISIONAL_GAMES: 10,
}));

mock.module('@/features/stats/repository', () => ({
  findServerByDiscordId: mock(() => Promise.resolve({ id: 1, discordId: '123', timezone: 'UTC', summaryChannelId: null, createdAt: new Date() })),
  createServer: mock(() => Promise.resolve({ id: 1, discordId: '123', timezone: 'UTC', summaryChannelId: null, createdAt: new Date() })),
}));

// Import after mocking
const { summaryCommand } = await import('@/commands/summary');
const { SummaryPeriod } = await import('@/features/summaries/service');

const TEST_GUILD_ID = '123456789';

const TEST_USERS: User[] = [
  { id: 1, serverId: 1, discordId: '111', wordleUsername: 'Alice', createdAt: new Date(), elo: 1500, eloGamesPlayed: 10, lastPlayedAt: null },
  { id: 2, serverId: 1, discordId: '222', wordleUsername: 'Bob', createdAt: new Date(), elo: 1500, eloGamesPlayed: 10, lastPlayedAt: null },
];

function createGame(userId: number, score: Score, wordleNumber: number): Game {
  return {
    id: wordleNumber,
    serverId: 1,
    userId,
    wordleNumber,
    score,
    playedAt: new Date(),
    messageId: null,
  };
}

function createMockInteraction(period: string | null = null) {
  return {
    guildId: TEST_GUILD_ID,
    options: {
      getString: mock(() => period),
    },
    client: {
      users: {
        fetch: mock((id: string) => Promise.resolve({ username: id })),
      },
    },
    deferReply: mock(() => Promise.resolve()),
    editReply: mock(() => Promise.resolve()),
    reply: mock(() => Promise.resolve()),
  };
}

describe('Summary Command', () => {
  beforeEach(() => {
    mockFindGamesByServerAndDateRange.mockClear();
    mockFindUsersByServer.mockClear();
    mockGetServerGroupStreak.mockClear();
    mockGetEloChangesForWordle.mockClear();
    mockGetOrCreateServer.mockClear();

    // Default setup - return empty data
    mockFindGamesByServerAndDateRange.mockResolvedValue([]);
    mockFindUsersByServer.mockResolvedValue([]);
    mockGetServerGroupStreak.mockResolvedValue(0);
    mockGetEloChangesForWordle.mockResolvedValue([]);
    mockGetEloHistoryForDateRange.mockResolvedValue([]);
  });

  describe('Command Definition', () => {
    test('Given command, When checking name, Then name is summary', () => {
      expect(summaryCommand.data.name).toBe('summary');
    });

    test('Given command, When checking options, Then has period option', () => {
      const options = summaryCommand.data.options;
      expect(options).toHaveLength(1);
      expect(options[0].name).toBe('period');
    });
  });

  describe('Command Execution', () => {
    test('Given no period specified, When executed, Then generates daily summary', async () => {
      const games = [createGame(1, Score.Three, 1000)];
      mockFindGamesByServerAndDateRange.mockResolvedValue(games);
      mockFindUsersByServer.mockResolvedValue(TEST_USERS);
      mockGetServerGroupStreak.mockResolvedValue(5);

      const interaction = createMockInteraction(null);
      await summaryCommand.execute(interaction as any);

      expect(interaction.deferReply).toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalled();
      // Verify an embed was returned
      const editReplyCall = (interaction.editReply as any).mock.calls[0];
      expect(editReplyCall[0]).toHaveProperty('embeds');
    });

    test('Given daily period, When executed, Then returns embed with daily data', async () => {
      const games = [
        createGame(1, Score.Three, 1000),
        createGame(2, Score.Four, 1000),
      ];
      mockFindGamesByServerAndDateRange.mockResolvedValue(games);
      mockFindUsersByServer.mockResolvedValue(TEST_USERS);
      mockGetServerGroupStreak.mockResolvedValue(3);

      const interaction = createMockInteraction(SummaryPeriod.Daily);
      await summaryCommand.execute(interaction as any);

      expect(interaction.editReply).toHaveBeenCalled();
      const editReplyCall = (interaction.editReply as any).mock.calls[0];
      expect(editReplyCall[0].embeds).toHaveLength(1);
    });

    test('Given weekly period, When executed, Then returns embed with weekly data', async () => {
      const games = [
        createGame(1, Score.Three, 1000),
        createGame(1, Score.Four, 1001),
        createGame(2, Score.Five, 1000),
      ];
      mockFindGamesByServerAndDateRange.mockResolvedValue(games);
      mockFindUsersByServer.mockResolvedValue(TEST_USERS);

      const interaction = createMockInteraction(SummaryPeriod.Weekly);
      await summaryCommand.execute(interaction as any);

      expect(interaction.editReply).toHaveBeenCalled();
    });

    test('Given monthly period, When executed, Then returns embed with monthly data', async () => {
      const games = [createGame(1, Score.Three, 1000)];
      mockFindGamesByServerAndDateRange.mockResolvedValue(games);
      mockFindUsersByServer.mockResolvedValue(TEST_USERS);

      const interaction = createMockInteraction(SummaryPeriod.Monthly);
      await summaryCommand.execute(interaction as any);

      expect(interaction.editReply).toHaveBeenCalled();
    });

    test('Given no guild, When executed, Then replies with error', async () => {
      const interaction = createMockInteraction();
      interaction.guildId = null;

      await summaryCommand.execute(interaction as any);

      expect(interaction.reply).toHaveBeenCalled();
      const replyCall = (interaction.reply as any).mock.calls[0];
      expect(replyCall[0].content).toContain('server');
      expect(replyCall[0].ephemeral).toBe(true);
    });

    test('Given no games, When executed, Then returns embed indicating no games', async () => {
      mockFindGamesByServerAndDateRange.mockResolvedValue([]);
      mockFindUsersByServer.mockResolvedValue([]);

      const interaction = createMockInteraction(SummaryPeriod.Daily);
      await summaryCommand.execute(interaction as any);

      expect(interaction.editReply).toHaveBeenCalled();
    });
  });
});
