import { describe, test, expect } from 'bun:test';
import {
  isTargetHourInTimezone,
  getDayOfWeekInTimezone,
  getDayOfMonthInTimezone,
} from '@/features/summaries/scheduler';

describe('Scheduler Timezone', () => {
  describe('isTargetHourInTimezone', () => {
    test('Given UTC timezone and 9 AM UTC, When checking for hour 9, Then returns true', () => {
      const date = new Date('2024-01-15T09:00:00Z');
      expect(isTargetHourInTimezone(date, 'UTC', 9)).toBe(true);
    });

    test('Given UTC timezone and 10 AM UTC, When checking for hour 9, Then returns false', () => {
      const date = new Date('2024-01-15T10:00:00Z');
      expect(isTargetHourInTimezone(date, 'UTC', 9)).toBe(false);
    });

    test('Given Europe/London and 9 AM UTC in summer (BST), When checking for hour 9, Then returns false', () => {
      // In summer, London is UTC+1, so 9 AM UTC = 10 AM London
      const date = new Date('2024-07-15T09:00:00Z');
      expect(isTargetHourInTimezone(date, 'Europe/London', 9)).toBe(false);
    });

    test('Given Europe/London and 8 AM UTC in summer (BST), When checking for hour 9, Then returns true', () => {
      // In summer, London is UTC+1, so 8 AM UTC = 9 AM London
      const date = new Date('2024-07-15T08:00:00Z');
      expect(isTargetHourInTimezone(date, 'Europe/London', 9)).toBe(true);
    });

    test('Given America/New_York and 14:00 UTC, When checking for hour 9, Then returns true', () => {
      // In winter, NY is UTC-5, so 14:00 UTC = 9 AM NY
      const date = new Date('2024-01-15T14:00:00Z');
      expect(isTargetHourInTimezone(date, 'America/New_York', 9)).toBe(true);
    });

    test('Given invalid timezone, When checking, Then defaults to UTC', () => {
      const date = new Date('2024-01-15T09:00:00Z');
      expect(isTargetHourInTimezone(date, 'Invalid/Timezone', 9)).toBe(true);
    });
  });

  describe('getDayOfWeekInTimezone', () => {
    test('Given UTC timezone, When getting day of week, Then returns correct day', () => {
      // 2024-01-15 is a Monday (day 1)
      const date = new Date('2024-01-15T12:00:00Z');
      expect(getDayOfWeekInTimezone(date, 'UTC')).toBe(1);
    });

    test('Given timezone where date crosses midnight, When getting day, Then returns correct local day', () => {
      // 2024-01-15 23:00 UTC = 2024-01-16 08:00 Tokyo (Tuesday = 2)
      const date = new Date('2024-01-15T23:00:00Z');
      expect(getDayOfWeekInTimezone(date, 'Asia/Tokyo')).toBe(2);
    });

    test('Given Sunday, When getting day of week, Then returns 0', () => {
      // 2024-01-14 is a Sunday
      const date = new Date('2024-01-14T12:00:00Z');
      expect(getDayOfWeekInTimezone(date, 'UTC')).toBe(0);
    });
  });

  describe('getDayOfMonthInTimezone', () => {
    test('Given UTC timezone, When getting day of month, Then returns correct day', () => {
      const date = new Date('2024-01-15T12:00:00Z');
      expect(getDayOfMonthInTimezone(date, 'UTC')).toBe(15);
    });

    test('Given timezone where date crosses midnight, When getting day, Then returns correct local day', () => {
      // 2024-01-31 23:00 UTC = 2024-02-01 08:00 Tokyo
      const date = new Date('2024-01-31T23:00:00Z');
      expect(getDayOfMonthInTimezone(date, 'Asia/Tokyo')).toBe(1);
    });

    test('Given first of month, When getting day, Then returns 1', () => {
      const date = new Date('2024-02-01T12:00:00Z');
      expect(getDayOfMonthInTimezone(date, 'UTC')).toBe(1);
    });
  });
});
