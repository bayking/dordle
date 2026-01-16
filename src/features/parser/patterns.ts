import { Score } from '@/features/stats';

export interface ParsedScore {
  discordId?: string;
  username?: string;
  score: Score;
}

export interface ParsedResult {
  groupStreak: number;
  scores: ParsedScore[];
  winners: string[];
}

const STREAK_PATTERN = /Your group is on a (\d+) day streak!/;
const RESULTS_INDICATOR = "Here are yesterday's results";

export function parseWordleMessage(content: string): ParsedResult | null {
  if (!content.includes(RESULTS_INDICATOR)) {
    return null;
  }

  const streakMatch = content.match(STREAK_PATTERN);
  if (!streakMatch) {
    return null;
  }

  const groupStreak = parseInt(streakMatch[1]!, 10);
  const scores: ParsedScore[] = [];
  const winners: string[] = [];

  const resultsStart = content.indexOf(RESULTS_INDICATOR);
  const resultsSection = content.slice(resultsStart);

  // Find all score entries with their users
  // Pattern: optional crown, score/6:, then usernames until next score or end
  const scoreEntryPattern = /(🏆)?\s*(\d|X)\/6:\s*([^🏆]*?)(?=\d\/6:|X\/6:|$)/g;

  let match;
  while ((match = scoreEntryPattern.exec(resultsSection)) !== null) {
    const isCrownLine = !!match[1];
    const scoreStr = match[2]!;
    const score: Score = scoreStr === 'X' ? Score.Fail : (parseInt(scoreStr, 10) as Score);
    const usersSection = match[3]!;

    // Extract Discord mentions <@123456> or <@!123456> and plain @usernames
    const mentionPattern = /<@!?(\d+)>/g;
    const usernamePattern = /@([^@<>\s]+)/g;

    let mentionMatch;
    while ((mentionMatch = mentionPattern.exec(usersSection)) !== null) {
      const discordId = mentionMatch[1]!;
      scores.push({ discordId, score });
      if (isCrownLine) {
        winners.push(discordId);
      }
    }

    // Also check for plain @usernames (fallback)
    if (scores.length === 0 || !usersSection.includes('<@')) {
      let userMatch;
      while ((userMatch = usernamePattern.exec(usersSection)) !== null) {
        const username = userMatch[1]!.trim();
        if (username && !username.includes('/6')) {
          scores.push({ username, score });
          if (isCrownLine) {
            winners.push(username);
          }
        }
      }
    }
  }

  if (scores.length === 0) {
    return null;
  }

  return {
    groupStreak,
    scores,
    winners,
  };
}
