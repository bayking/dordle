import { describe, test, expect } from 'bun:test';
import { parseWordleMessage } from '@/features/parser/patterns';

// Test constants
const DISCORD_IDS = {
  ALICE: '111111111111111111',
  BOB: '222222222222222222',
  CHARLIE: '333333333333333333',
  DAVE: '444444444444444444',
  EVE: '555555555555555555',
} as const;

describe('Wordle Message Parser', () => {
  describe('Given a Wordle app message with Discord mentions', () => {
    test('When parsed, Then extracts all user Discord IDs correctly', () => {
      const message = `Your group is on a 5 day streak! 🔥 Here are yesterday's results:

🏆 3/6: <@${DISCORD_IDS.ALICE}> <@${DISCORD_IDS.BOB}>
4/6: <@${DISCORD_IDS.CHARLIE}>
5/6: <@${DISCORD_IDS.DAVE}> <@${DISCORD_IDS.EVE}>`;

      const result = parseWordleMessage(message);

      expect(result).not.toBeNull();
      expect(result!.groupStreak).toBe(5);
      expect(result!.scores).toHaveLength(5);
      expect(result!.scores).toContainEqual({ discordId: DISCORD_IDS.ALICE, score: 3 });
      expect(result!.scores).toContainEqual({ discordId: DISCORD_IDS.BOB, score: 3 });
      expect(result!.scores).toContainEqual({ discordId: DISCORD_IDS.CHARLIE, score: 4 });
      expect(result!.scores).toContainEqual({ discordId: DISCORD_IDS.DAVE, score: 5 });
      expect(result!.scores).toContainEqual({ discordId: DISCORD_IDS.EVE, score: 5 });
    });

    test('When message has nickname mentions, Then extracts IDs correctly', () => {
      const message = `Your group is on a 2 day streak! 🔥 Here are yesterday's results:

🏆 3/6: <@!${DISCORD_IDS.ALICE}>
4/6: <@!${DISCORD_IDS.BOB}>`;

      const result = parseWordleMessage(message);

      expect(result).not.toBeNull();
      expect(result!.scores).toHaveLength(2);
      expect(result!.scores).toContainEqual({ discordId: DISCORD_IDS.ALICE, score: 3 });
      expect(result!.scores).toContainEqual({ discordId: DISCORD_IDS.BOB, score: 4 });
    });
  });

  describe('Given a Wordle app message with plain usernames (fallback)', () => {
    test('When parsed, Then extracts usernames correctly', () => {
      const message = `Your group is on a 5 day streak! 🔥 Here are yesterday's results:

🏆 3/6: @Alice @Bob
4/6: @Charlie
5/6: @Dave @Eve`;

      const result = parseWordleMessage(message);

      expect(result).not.toBeNull();
      expect(result!.groupStreak).toBe(5);
      expect(result!.scores).toHaveLength(5);
      expect(result!.scores).toContainEqual({ username: 'Alice', score: 3 });
      expect(result!.scores).toContainEqual({ username: 'Bob', score: 3 });
      expect(result!.scores).toContainEqual({ username: 'Charlie', score: 4 });
      expect(result!.scores).toContainEqual({ username: 'Dave', score: 5 });
      expect(result!.scores).toContainEqual({ username: 'Eve', score: 5 });
    });
  });

  describe('Given a message with X/6 (fail)', () => {
    test('When parsed, Then score is recorded as 7', () => {
      const message = `Your group is on a 4 day streak! 🔥 Here are yesterday's results:

🏆 3/6: @Alice @Bob
5/6: @Charlie
6/6: @Dave
X/6: @Eve`;

      const result = parseWordleMessage(message);

      expect(result).not.toBeNull();
      expect(result!.scores).toContainEqual({ username: 'Eve', score: 7 });
      expect(result!.scores).toContainEqual({ username: 'Dave', score: 6 });
    });
  });

  describe('Given a message with crown emoji', () => {
    test('When trophy emoji 🏆, Then identifies the winners', () => {
      const message = `Your group is on a 3 day streak! 🔥 Here are yesterday's results:

🏆 4/6: @Alice
5/6: @Bob
6/6: @Charlie`;

      const result = parseWordleMessage(message);

      expect(result).not.toBeNull();
      expect(result!.winners).toEqual(['Alice']);
    });

    test('When crown emoji 👑, Then identifies the winners', () => {
      const message = `Your group is on a 3 day streak! 🔥 Here are yesterday's results:

👑 4/6: @Alice
5/6: @Bob
6/6: @Charlie`;

      const result = parseWordleMessage(message);

      expect(result).not.toBeNull();
      expect(result!.winners).toEqual(['Alice']);
    });

    test('When multiple winners, Then identifies all winners', () => {
      const message = `Your group is on a 5 day streak! 🔥 Here are yesterday's results:

🏆 3/6: @Alice @Bob
4/6: @Charlie`;

      const result = parseWordleMessage(message);

      expect(result).not.toBeNull();
      expect(result!.winners).toContain('Alice');
      expect(result!.winners).toContain('Bob');
    });
  });

  describe('Given mixed Discord mentions and plain usernames', () => {
    test('When same line has both formats, Then extracts both separately', () => {
      const message = `Your group is on a 2 day streak! 🔥 Here are yesterday's results:

👑 3/6: <@${DISCORD_IDS.ALICE}>
5/6: @pjong <@${DISCORD_IDS.BOB}>`;

      const result = parseWordleMessage(message);

      expect(result).not.toBeNull();
      expect(result!.scores).toHaveLength(3);
      expect(result!.scores).toContainEqual({ discordId: DISCORD_IDS.ALICE, score: 3 });
      expect(result!.scores).toContainEqual({ username: 'pjong', score: 5 });
      expect(result!.scores).toContainEqual({ discordId: DISCORD_IDS.BOB, score: 5 });
    });

    test('When only plain usernames on some lines, Then extracts them', () => {
      const message = `Your group is on a 3 day streak! 🔥 Here are yesterday's results:

👑 4/6: @runar12
5/6: <@${DISCORD_IDS.ALICE}>
6/6: @pjong`;

      const result = parseWordleMessage(message);

      expect(result).not.toBeNull();
      expect(result!.scores).toHaveLength(3);
      expect(result!.scores).toContainEqual({ username: 'runar12', score: 4 });
      expect(result!.scores).toContainEqual({ discordId: DISCORD_IDS.ALICE, score: 5 });
      expect(result!.scores).toContainEqual({ username: 'pjong', score: 6 });
    });
  });

  describe('Given a non-Wordle summary message', () => {
    test('When checked, Then returns null (ignored)', () => {
      const message = 'Hello everyone! How are you doing today?';
      expect(parseWordleMessage(message)).toBeNull();
    });

    test('When "was playing" message, Then returns null (ignored)', () => {
      const message = 'player1 was playing';
      expect(parseWordleMessage(message)).toBeNull();
    });

    test('When "Play now!" only message, Then returns null (ignored)', () => {
      const message = 'Play now!';
      expect(parseWordleMessage(message)).toBeNull();
    });
  });

  describe('Given a 1 day streak message', () => {
    test('When parsed, Then extracts streak correctly', () => {
      const message = `Your group is on a 1 day streak! 🔥 Here are yesterday's results:

🏆 3/6: @Alice
4/6: @Bob`;

      const result = parseWordleMessage(message);

      expect(result).not.toBeNull();
      expect(result!.groupStreak).toBe(1);
    });
  });

  describe('Given varied score formats', () => {
    test('When parsed, Then handles all valid scores 1-6 and X', () => {
      const message = `Your group is on a 7 day streak! 🔥 Here are yesterday's results:

🏆 1/6: @p1
2/6: @p2
3/6: @p3
4/6: @p4
5/6: @p5
6/6: @p6
X/6: @p7`;

      const result = parseWordleMessage(message);

      expect(result).not.toBeNull();
      expect(result!.scores).toHaveLength(7);
      expect(result!.scores).toContainEqual({ username: 'p1', score: 1 });
      expect(result!.scores).toContainEqual({ username: 'p2', score: 2 });
      expect(result!.scores).toContainEqual({ username: 'p3', score: 3 });
      expect(result!.scores).toContainEqual({ username: 'p4', score: 4 });
      expect(result!.scores).toContainEqual({ username: 'p5', score: 5 });
      expect(result!.scores).toContainEqual({ username: 'p6', score: 6 });
      expect(result!.scores).toContainEqual({ username: 'p7', score: 7 });
    });
  });

  describe('Given inline format', () => {
    test('When scores are on single line, Then parses correctly', () => {
      const message = `Your group is on a 1 day streak! 🔥 Here are yesterday's results: 🏆 3/6: @Alice 4/6: @Bob`;

      const result = parseWordleMessage(message);

      expect(result).not.toBeNull();
      expect(result!.scores).toHaveLength(2);
      expect(result!.scores).toContainEqual({ username: 'Alice', score: 3 });
      expect(result!.scores).toContainEqual({ username: 'Bob', score: 4 });
    });
  });
});
