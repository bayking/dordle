import { describe, test, expect, mock } from 'bun:test';
import type { Guild } from 'discord.js';

// Test constants
const DISCORD_IDS = {
  PJONG: '117319504228253701',
  RUNAR: '116986846306762752',
  BAY: '173880763413037056',
} as const;

const USERNAMES = {
  PJONG: 'pjong',
  RUNAR: 'runar12',
  BAY: 'bay',
} as const;

// We'll test the resolveUser function that will be created
// It should:
// 1. Given discordId only -> fetch username from Discord API
// 2. Given username only -> search guild members for Discord ID
// 3. Given both -> return both directly

describe('User Resolution', () => {
  describe('Given a Discord ID without username', () => {
    test('When resolved, Then fetches username from Discord API', async () => {
      const mockUser = { id: DISCORD_IDS.PJONG, username: USERNAMES.PJONG };
      const mockFetch = mock(() => Promise.resolve({ user: mockUser }));
      const mockGuild = {
        members: {
          fetch: mockFetch,
        },
      } as unknown as Guild;

      const { resolveUser } = await import('@/features/parser/resolver');
      const result = await resolveUser(mockGuild, { discordId: DISCORD_IDS.PJONG });

      expect(result.discordId).toBe(DISCORD_IDS.PJONG);
      expect(result.username).toBe(USERNAMES.PJONG);
    });
  });

  describe('Given a username without Discord ID', () => {
    test('When resolved and member found, Then returns Discord ID', async () => {
      const mockMember = {
        id: DISCORD_IDS.RUNAR,
        user: { id: DISCORD_IDS.RUNAR, username: USERNAMES.RUNAR },
      };
      const mockCollection = new Map([[DISCORD_IDS.RUNAR, mockMember]]);
      (mockCollection as any).first = () => mockMember;

      const mockFetch = mock(() => Promise.resolve(mockCollection));
      const mockGuild = {
        members: {
          fetch: mockFetch,
        },
      } as unknown as Guild;

      const { resolveUser } = await import('@/features/parser/resolver');
      const result = await resolveUser(mockGuild, { username: USERNAMES.RUNAR });

      expect(result.discordId).toBe(DISCORD_IDS.RUNAR);
      expect(result.username).toBe(USERNAMES.RUNAR);
    });

    test('When resolved and member not found, Then returns wordle-prefixed ID', async () => {
      const mockCollection = new Map();
      (mockCollection as any).first = () => undefined;

      const mockFetch = mock(() => Promise.resolve(mockCollection));
      const mockGuild = {
        members: {
          fetch: mockFetch,
        },
      } as unknown as Guild;

      const { resolveUser } = await import('@/features/parser/resolver');
      const result = await resolveUser(mockGuild, { username: USERNAMES.BAY });

      expect(result.discordId).toBe(`wordle:${USERNAMES.BAY}`);
      expect(result.username).toBe(USERNAMES.BAY);
    });
  });

  describe('Given both Discord ID and username', () => {
    test('When resolved, Then returns both without API call', async () => {
      const mockFetch = mock(() => Promise.resolve({}));
      const mockGuild = {
        members: {
          fetch: mockFetch,
        },
      } as unknown as Guild;

      const { resolveUser } = await import('@/features/parser/resolver');
      const result = await resolveUser(mockGuild, {
        discordId: DISCORD_IDS.PJONG,
        username: USERNAMES.PJONG,
      });

      expect(result.discordId).toBe(DISCORD_IDS.PJONG);
      expect(result.username).toBe(USERNAMES.PJONG);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
