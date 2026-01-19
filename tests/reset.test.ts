import { describe, test, expect, mock, beforeEach } from 'bun:test';

// Create mock
const mockGetDb = mock(() => ({}));

// Mock module before importing the service
mock.module('@/db', () => ({
  getDb: mockGetDb,
}));

// Import after mocking
const { deleteServerStats } = await import('@/features/stats/repository');

// Test constants
const TEST_SERVER_ID = 1;

const MOCK_DELETED = {
  THREE_GAMES: [{ id: 1 }, { id: 2 }, { id: 3 }],
  TWO_USERS: [{ id: 1 }, { id: 2 }],
  EMPTY: [],
} as const;

describe('Delete Server Stats', () => {
  beforeEach(() => {
    mockGetDb.mockClear();
  });

  test('Given server with games and users, When deleted, Then returns correct counts', async () => {
    const mockReturning = mock(() => Promise.resolve(MOCK_DELETED.THREE_GAMES));
    const mockWhere = mock(() => ({ returning: mockReturning }));
    const mockDelete = mock(() => ({ where: mockWhere }));

    // Set up returning to return different values on subsequent calls
    mockReturning
      .mockResolvedValueOnce(MOCK_DELETED.THREE_GAMES)
      .mockResolvedValueOnce(MOCK_DELETED.TWO_USERS);

    mockGetDb.mockReturnValue({
      delete: mockDelete,
    });

    const result = await deleteServerStats(TEST_SERVER_ID);

    expect(result.gamesDeleted).toBe(3);
    expect(result.usersDeleted).toBe(2);
    expect(mockDelete).toHaveBeenCalledTimes(2);
  });

  test('Given empty server, When deleted, Then returns zero counts', async () => {
    const mockReturning = mock(() => Promise.resolve(MOCK_DELETED.EMPTY));
    const mockWhere = mock(() => ({ returning: mockReturning }));
    const mockDelete = mock(() => ({ where: mockWhere }));

    mockGetDb.mockReturnValue({
      delete: mockDelete,
    });

    const result = await deleteServerStats(TEST_SERVER_ID);

    expect(result.gamesDeleted).toBe(0);
    expect(result.usersDeleted).toBe(0);
  });

  test('Given server with only games, When deleted, Then deletes games before users', async () => {
    const mockReturning = mock(() => Promise.resolve(MOCK_DELETED.THREE_GAMES));
    const mockWhere = mock(() => ({ returning: mockReturning }));
    const mockDelete = mock(() => ({ where: mockWhere }));

    mockReturning
      .mockResolvedValueOnce(MOCK_DELETED.THREE_GAMES)
      .mockResolvedValueOnce(MOCK_DELETED.EMPTY);

    mockGetDb.mockReturnValue({
      delete: mockDelete,
    });

    const result = await deleteServerStats(TEST_SERVER_ID);

    expect(result.gamesDeleted).toBe(3);
    expect(result.usersDeleted).toBe(0);
  });
});
