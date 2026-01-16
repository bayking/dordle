import { describe, it, expect } from 'vitest';
import {
  calculateDailyEloChanges,
  getKFactor,
  type EloUpdate,
  type PlayerGame,
} from '@/features/elo/service';
import {
  DEFAULT_ELO,
  K_FACTOR_PROVISIONAL,
  K_FACTOR_ESTABLISHING,
  K_FACTOR_ESTABLISHED,
  PROVISIONAL_GAMES,
  ESTABLISHING_GAMES,
  MIN_PLAYERS_FOR_ELO,
  FAIL_EFFECTIVE_SCORE,
  FAIL_PENALTY,
} from '@/features/elo/constants';

// Test constants
const TEST_USER_IDS = {
  ALICE: 1,
  BOB: 2,
  CHARLIE: 3,
  DAVID: 4,
};

const SCORES = {
  EXCELLENT: 2,
  GOOD: 3,
  AVERAGE: 4,
  BELOW_AVERAGE: 5,
  POOR: 6,
  FAIL: 7,
};

function createPlayer(
  userId: number,
  elo: number,
  score: number,
  gamesPlayed = 50
): PlayerGame {
  return { userId, elo, score, gamesPlayed };
}

describe('ELO Constants', () => {
  it('DEFAULT_ELO is 1500', () => {
    expect(DEFAULT_ELO).toBe(1500);
  });

  it('K-factors are correctly tiered', () => {
    expect(K_FACTOR_PROVISIONAL).toBe(40);
    expect(K_FACTOR_ESTABLISHING).toBe(32);
    expect(K_FACTOR_ESTABLISHED).toBe(24);
  });

  it('Game thresholds are defined', () => {
    expect(PROVISIONAL_GAMES).toBe(10);
    expect(ESTABLISHING_GAMES).toBe(30);
  });

  it('MIN_PLAYERS_FOR_ELO is 2', () => {
    expect(MIN_PLAYERS_FOR_ELO).toBe(2);
  });

  it('FAIL_EFFECTIVE_SCORE is 9', () => {
    expect(FAIL_EFFECTIVE_SCORE).toBe(9);
  });

  it('FAIL_PENALTY is 3', () => {
    expect(FAIL_PENALTY).toBe(3);
  });
});

describe('getKFactor', () => {
  it('Returns provisional K-factor for new players (0-10 games)', () => {
    expect(getKFactor(0)).toBe(K_FACTOR_PROVISIONAL);
    expect(getKFactor(5)).toBe(K_FACTOR_PROVISIONAL);
    expect(getKFactor(10)).toBe(K_FACTOR_PROVISIONAL);
  });

  it('Returns establishing K-factor for mid players (11-30 games)', () => {
    expect(getKFactor(11)).toBe(K_FACTOR_ESTABLISHING);
    expect(getKFactor(20)).toBe(K_FACTOR_ESTABLISHING);
    expect(getKFactor(30)).toBe(K_FACTOR_ESTABLISHING);
  });

  it('Returns established K-factor for veteran players (31+ games)', () => {
    expect(getKFactor(31)).toBe(K_FACTOR_ESTABLISHED);
    expect(getKFactor(100)).toBe(K_FACTOR_ESTABLISHED);
    expect(getKFactor(500)).toBe(K_FACTOR_ESTABLISHED);
  });
});

describe('calculateDailyEloChanges', () => {
  describe('Given no players', () => {
    it('Returns empty array', () => {
      const updates = calculateDailyEloChanges([]);
      expect(updates).toHaveLength(0);
    });
  });

  describe('Given single player', () => {
    it('Returns no change (insufficient competition)', () => {
      const players: PlayerGame[] = [
        createPlayer(TEST_USER_IDS.ALICE, DEFAULT_ELO, SCORES.EXCELLENT),
      ];

      const updates = calculateDailyEloChanges(players);

      expect(updates).toHaveLength(1);
      expect(updates[0]!.change).toBe(0);
      expect(updates[0]!.newElo).toBe(updates[0]!.oldElo);
    });
  });

  describe('Given players with mixed scores', () => {
    it('Better-than-average players gain ELO, worse lose ELO', () => {
      const players: PlayerGame[] = [
        createPlayer(TEST_USER_IDS.ALICE, DEFAULT_ELO, SCORES.EXCELLENT), // 2
        createPlayer(TEST_USER_IDS.BOB, DEFAULT_ELO, SCORES.AVERAGE), // 4
        createPlayer(TEST_USER_IDS.CHARLIE, DEFAULT_ELO, SCORES.POOR), // 6
      ];
      // Average score: (2 + 4 + 6) / 3 = 4

      const updates = calculateDailyEloChanges(players);

      expect(updates).toHaveLength(3);

      const aliceUpdate = updates.find((u) => u.userId === TEST_USER_IDS.ALICE)!;
      const bobUpdate = updates.find((u) => u.userId === TEST_USER_IDS.BOB)!;
      const charlieUpdate = updates.find((u) => u.userId === TEST_USER_IDS.CHARLIE)!;

      // Alice scored better than average (2 < 4), gains ELO
      expect(aliceUpdate.change).toBeGreaterThan(0);
      expect(aliceUpdate.newElo).toBeGreaterThan(aliceUpdate.oldElo);

      // Charlie scored worse than average (6 > 4), loses ELO
      expect(charlieUpdate.change).toBeLessThan(0);
      expect(charlieUpdate.newElo).toBeLessThan(charlieUpdate.oldElo);

      // ELO changes should roughly balance out (zero-sum)
      const totalChange = updates.reduce((sum, u) => sum + u.change, 0);
      expect(Math.abs(totalChange)).toBeLessThan(5); // Allow small rounding
    });
  });

  describe('Given player scores exactly average', () => {
    it('Minimal ELO change when all same ELO', () => {
      const players: PlayerGame[] = [
        createPlayer(TEST_USER_IDS.ALICE, DEFAULT_ELO, SCORES.GOOD), // 3
        createPlayer(TEST_USER_IDS.BOB, DEFAULT_ELO, SCORES.AVERAGE), // 4
        createPlayer(TEST_USER_IDS.CHARLIE, DEFAULT_ELO, SCORES.BELOW_AVERAGE), // 5
      ];
      // Average: 4

      const updates = calculateDailyEloChanges(players);
      const bobUpdate = updates.find((u) => u.userId === TEST_USER_IDS.BOB)!;

      // Bob scored exactly average (4), minimal change
      expect(Math.abs(bobUpdate.change)).toBeLessThan(3);
    });
  });

  describe('Given player fails (score 7)', () => {
    it('Fail is treated as score 9, always loses ELO', () => {
      const players: PlayerGame[] = [
        createPlayer(TEST_USER_IDS.ALICE, DEFAULT_ELO, SCORES.AVERAGE), // 4
        createPlayer(TEST_USER_IDS.BOB, DEFAULT_ELO, SCORES.FAIL), // 7 → 9
        createPlayer(TEST_USER_IDS.CHARLIE, DEFAULT_ELO, SCORES.AVERAGE), // 4
      ];

      const updates = calculateDailyEloChanges(players);
      const bobUpdate = updates.find((u) => u.userId === TEST_USER_IDS.BOB)!;

      // Bob failed, should lose significant ELO
      expect(bobUpdate.change).toBeLessThan(-10);
      expect(bobUpdate.newElo).toBeLessThan(bobUpdate.oldElo);
    });

    it('All failures still result in ELO loss', () => {
      const players: PlayerGame[] = [
        createPlayer(TEST_USER_IDS.ALICE, DEFAULT_ELO, SCORES.FAIL),
        createPlayer(TEST_USER_IDS.BOB, DEFAULT_ELO, SCORES.FAIL),
      ];

      const updates = calculateDailyEloChanges(players);

      // All players failed - both should lose ELO
      for (const update of updates) {
        expect(update.change).toBeLessThan(0);
      }
    });
  });

  describe('Given new player vs high ELO players', () => {
    it('Underdog gains more ELO when outperforming', () => {
      const highElo = 1700;
      const players: PlayerGame[] = [
        createPlayer(TEST_USER_IDS.ALICE, DEFAULT_ELO, SCORES.EXCELLENT), // 1500, scores 2
        createPlayer(TEST_USER_IDS.BOB, highElo, SCORES.AVERAGE), // 1700, scores 4
        createPlayer(TEST_USER_IDS.CHARLIE, highElo, SCORES.AVERAGE), // 1700, scores 4
      ];

      const updates = calculateDailyEloChanges(players);
      const aliceUpdate = updates.find((u) => u.userId === TEST_USER_IDS.ALICE)!;

      // Alice as underdog beating high ELO players should gain significant ELO
      expect(aliceUpdate.change).toBeGreaterThan(10);
    });

    it('Favorite loses more ELO when underperforming', () => {
      const highElo = 1700;
      const players: PlayerGame[] = [
        createPlayer(TEST_USER_IDS.ALICE, DEFAULT_ELO, SCORES.EXCELLENT), // Low ELO, scores well
        createPlayer(TEST_USER_IDS.BOB, highElo, SCORES.POOR), // High ELO, scores poorly
      ];

      const updates = calculateDailyEloChanges(players);
      const bobUpdate = updates.find((u) => u.userId === TEST_USER_IDS.BOB)!;

      // Bob as favorite losing should lose significant ELO
      expect(bobUpdate.change).toBeLessThan(-10);
    });
  });

  describe('Given expected score capping', () => {
    it('High ELO player can still gain ELO when winning (cap at 0.9)', () => {
      const veryHighElo = 2000;
      const lowElo = 1200;
      const players: PlayerGame[] = [
        createPlayer(TEST_USER_IDS.ALICE, veryHighElo, SCORES.EXCELLENT, 50), // 2000, scores 2
        createPlayer(TEST_USER_IDS.BOB, lowElo, SCORES.POOR, 50), // 1200, scores 6
      ];

      const updates = calculateDailyEloChanges(players);
      const aliceUpdate = updates.find((u) => u.userId === TEST_USER_IDS.ALICE)!;

      // Even with huge ELO advantage, Alice should gain some ELO for winning
      expect(aliceUpdate.change).toBeGreaterThan(0);
    });

    it('Low ELO player does not lose catastrophically (cap at 0.1)', () => {
      const veryHighElo = 2000;
      const lowElo = 1200;
      const players: PlayerGame[] = [
        createPlayer(TEST_USER_IDS.ALICE, veryHighElo, SCORES.EXCELLENT, 50),
        createPlayer(TEST_USER_IDS.BOB, lowElo, SCORES.POOR, 50),
      ];

      const updates = calculateDailyEloChanges(players);
      const bobUpdate = updates.find((u) => u.userId === TEST_USER_IDS.BOB)!;

      // Bob shouldn't lose more than reasonable amount
      expect(bobUpdate.change).toBeGreaterThan(-20);
    });
  });

  describe('Given tied scores', () => {
    it('ELO changes based on relative rating', () => {
      const players: PlayerGame[] = [
        createPlayer(TEST_USER_IDS.ALICE, 1400, SCORES.AVERAGE), // Lower ELO
        createPlayer(TEST_USER_IDS.BOB, 1600, SCORES.AVERAGE), // Higher ELO
      ];

      const updates = calculateDailyEloChanges(players);
      const aliceUpdate = updates.find((u) => u.userId === TEST_USER_IDS.ALICE)!;
      const bobUpdate = updates.find((u) => u.userId === TEST_USER_IDS.BOB)!;

      // Same scores: lower ELO gains (met expectations), higher ELO loses (expected better)
      expect(aliceUpdate.change).toBeGreaterThan(bobUpdate.change);
    });
  });

  describe('Given K-factor by games played', () => {
    it('Provisional player has larger ELO swings', () => {
      const players: PlayerGame[] = [
        createPlayer(TEST_USER_IDS.ALICE, DEFAULT_ELO, SCORES.EXCELLENT, 5), // Provisional
        createPlayer(TEST_USER_IDS.BOB, DEFAULT_ELO, SCORES.POOR, 5), // Provisional
      ];

      const updates = calculateDailyEloChanges(players);
      const aliceUpdate = updates.find((u) => u.userId === TEST_USER_IDS.ALICE)!;

      // Provisional K=40, should have larger changes
      expect(Math.abs(aliceUpdate.change)).toBeGreaterThan(15);
    });

    it('Established player has smaller ELO swings', () => {
      const players: PlayerGame[] = [
        createPlayer(TEST_USER_IDS.ALICE, DEFAULT_ELO, SCORES.EXCELLENT, 100), // Established
        createPlayer(TEST_USER_IDS.BOB, DEFAULT_ELO, SCORES.POOR, 100), // Established
      ];

      const updates = calculateDailyEloChanges(players);
      const aliceUpdate = updates.find((u) => u.userId === TEST_USER_IDS.ALICE)!;

      // Established K=24, should have smaller changes than provisional
      expect(Math.abs(aliceUpdate.change)).toBeLessThan(20);
    });
  });

  describe('Given EloUpdate structure', () => {
    it('Returns correct structure with all fields', () => {
      const players: PlayerGame[] = [
        createPlayer(TEST_USER_IDS.ALICE, DEFAULT_ELO, SCORES.GOOD),
        createPlayer(TEST_USER_IDS.BOB, DEFAULT_ELO, SCORES.AVERAGE),
      ];

      const updates = calculateDailyEloChanges(players);

      for (const update of updates) {
        expect(update).toHaveProperty('userId');
        expect(update).toHaveProperty('oldElo');
        expect(update).toHaveProperty('newElo');
        expect(update).toHaveProperty('change');
        expect(typeof update.userId).toBe('number');
        expect(typeof update.oldElo).toBe('number');
        expect(typeof update.newElo).toBe('number');
        expect(typeof update.change).toBe('number');
        // Verify newElo = oldElo + change
        expect(update.newElo).toBe(update.oldElo + update.change);
      }
    });

    it('ELO values are integers', () => {
      const players: PlayerGame[] = [
        createPlayer(TEST_USER_IDS.ALICE, DEFAULT_ELO, SCORES.GOOD),
        createPlayer(TEST_USER_IDS.BOB, DEFAULT_ELO, SCORES.BELOW_AVERAGE),
      ];

      const updates = calculateDailyEloChanges(players);

      for (const update of updates) {
        expect(Number.isInteger(update.newElo)).toBe(true);
        expect(Number.isInteger(update.change)).toBe(true);
      }
    });
  });
});
