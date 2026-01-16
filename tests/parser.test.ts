import { describe, it, expect } from 'vitest';
import { parseWordleMessage } from '@/features/parser/patterns';

describe('Wordle Message Parser', () => {
  describe('Given a Wordle app summary message', () => {
    it('When parsed, Then extracts all user scores correctly', () => {
      const message = `Your group is on a 5 day streak! 🔥 Here are yesterday's results:

🏆 3/6: @Alice Smith @Bob
4/6: @Charlie
5/6: @Dave @Eve`;

      const result = parseWordleMessage(message);

      expect(result).not.toBeNull();
      expect(result!.groupStreak).toBe(5);
      expect(result!.scores).toHaveLength(5);
      expect(result!.scores).toContainEqual({ username: 'Alice Smith', score: 3 });
      expect(result!.scores).toContainEqual({ username: 'Bob', score: 3 });
      expect(result!.scores).toContainEqual({ username: 'Charlie', score: 4 });
      expect(result!.scores).toContainEqual({ username: 'Dave', score: 5 });
      expect(result!.scores).toContainEqual({ username: 'Eve', score: 5 });
    });
  });

  describe('Given a message with X/6 (fail)', () => {
    it('When parsed, Then score is recorded as 7', () => {
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
    it('When parsed, Then identifies the winners', () => {
      const message = `Your group is on a 3 day streak! 🔥 Here are yesterday's results:

🏆 4/6: @Alice
5/6: @Bob
6/6: @Charlie`;

      const result = parseWordleMessage(message);

      expect(result).not.toBeNull();
      expect(result!.winners).toEqual(['Alice']);
    });

    it('When multiple winners, Then identifies all winners', () => {
      const message = `Your group is on a 5 day streak! 🔥 Here are yesterday's results:

🏆 3/6: @Alice @Bob
4/6: @Charlie`;

      const result = parseWordleMessage(message);

      expect(result).not.toBeNull();
      expect(result!.winners).toContain('Alice');
      expect(result!.winners).toContain('Bob');
    });
  });

  describe('Given a non-Wordle summary message', () => {
    it('When checked, Then returns null (ignored)', () => {
      const message = 'Hello everyone! How are you doing today?';
      expect(parseWordleMessage(message)).toBeNull();
    });

    it('When "was playing" message, Then returns null (ignored)', () => {
      const message = 'player1 was playing';
      expect(parseWordleMessage(message)).toBeNull();
    });

    it('When "Play now!" only message, Then returns null (ignored)', () => {
      const message = 'Play now!';
      expect(parseWordleMessage(message)).toBeNull();
    });
  });

  describe('Given a 1 day streak message', () => {
    it('When parsed, Then extracts streak correctly', () => {
      const message = `Your group is on a 1 day streak! 🔥 Here are yesterday's results:

🏆 3/6: @Alice
4/6: @Bob`;

      const result = parseWordleMessage(message);

      expect(result).not.toBeNull();
      expect(result!.groupStreak).toBe(1);
    });
  });

  describe('Given varied score formats', () => {
    it('When parsed, Then handles all valid scores 1-6 and X', () => {
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
    it('When scores are on single line, Then parses correctly', () => {
      const message = `Your group is on a 1 day streak! 🔥 Here are yesterday's results: 🏆 3/6: @Alice 4/6: @Bob`;

      const result = parseWordleMessage(message);

      expect(result).not.toBeNull();
      expect(result!.scores).toHaveLength(2);
      expect(result!.scores).toContainEqual({ username: 'Alice', score: 3 });
      expect(result!.scores).toContainEqual({ username: 'Bob', score: 4 });
    });
  });
});
