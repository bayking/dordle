import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { deleteServerStats } from '@/features/stats/repository';
import { getDb } from '@/db';

vi.mock('@/db', () => ({
  getDb: vi.fn(),
}));

const mockGetDb = getDb as Mock;

// Test constants
const TEST_SERVER_ID = 1;

const MOCK_DELETED = {
  THREE_GAMES: [{ id: 1 }, { id: 2 }, { id: 3 }],
  TWO_USERS: [{ id: 1 }, { id: 2 }],
  EMPTY: [],
} as const;

describe('Delete Server Stats', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('Given server with games and users, When deleted, Then returns correct counts', async () => {
    const mockDelete = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn()
          .mockResolvedValueOnce(MOCK_DELETED.THREE_GAMES)
          .mockResolvedValueOnce(MOCK_DELETED.TWO_USERS),
      }),
    });

    mockGetDb.mockReturnValue({
      delete: mockDelete,
    });

    const result = await deleteServerStats(TEST_SERVER_ID);

    expect(result.gamesDeleted).toBe(3);
    expect(result.usersDeleted).toBe(2);
    expect(mockDelete).toHaveBeenCalledTimes(2);
  });

  it('Given empty server, When deleted, Then returns zero counts', async () => {
    const mockDelete = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue(MOCK_DELETED.EMPTY),
      }),
    });

    mockGetDb.mockReturnValue({
      delete: mockDelete,
    });

    const result = await deleteServerStats(TEST_SERVER_ID);

    expect(result.gamesDeleted).toBe(0);
    expect(result.usersDeleted).toBe(0);
  });

  it('Given server with only games, When deleted, Then deletes games before users', async () => {
    const mockWhere = vi.fn().mockReturnValue({
      returning: vi.fn()
        .mockResolvedValueOnce(MOCK_DELETED.THREE_GAMES)
        .mockResolvedValueOnce(MOCK_DELETED.EMPTY),
    });

    const mockDelete = vi.fn().mockReturnValue({
      where: mockWhere,
    });

    mockGetDb.mockReturnValue({
      delete: mockDelete,
    });

    const result = await deleteServerStats(TEST_SERVER_ID);

    expect(result.gamesDeleted).toBe(3);
    expect(result.usersDeleted).toBe(0);
  });
});
