import type { Message } from 'discord.js';
import { parseWordleMessage } from '@/features/parser/patterns';
import { resolveUser } from '@/features/parser/resolver';
import { getOrCreateServer, getOrCreateUser, recordGame } from '@/features/stats';
import { processWordleElo } from '@/features/elo';
import { log } from '@/infrastructure/logger';

export { parseWordleMessage } from '@/features/parser/patterns';
export type { ParsedResult, ParsedScore } from '@/features/parser/patterns';
export { resolveUser } from '@/features/parser/resolver';

const WORDLE_APP_USERNAME = 'Wordle';

/**
 * Calculate "yesterday" based on the server's timezone.
 * The Wordle app posts "yesterday's results" after midnight in the user's timezone.
 * We need to determine what date "yesterday" is in the server's configured timezone.
 */
function getYesterdayInTimezone(messageDate: Date, timezone: string): Date {
  // Format the message date in the server's timezone to get the local date
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const localDateStr = formatter.format(messageDate); // Returns YYYY-MM-DD

  // Parse the local date and subtract 1 day to get "yesterday"
  const [year, month, day] = localDateStr.split('-').map(Number);
  const localDate = new Date(Date.UTC(year!, month! - 1, day!));

  // Subtract 1 day
  localDate.setUTCDate(localDate.getUTCDate() - 1);

  return localDate;
}

export async function handleMessage(message: Message): Promise<void> {
  if (!message.guildId) return;
  if (message.author.username !== WORDLE_APP_USERNAME) return;
  if (!message.guild) return;

  const parsed = parseWordleMessage(message.content);
  if (!parsed) {
    log.debug({ content: message.content.substring(0, 100) }, 'message not parsed');
    return;
  }

  log.info({ scores: parsed.scores.length, streak: parsed.groupStreak }, 'parsed message');

  const server = await getOrCreateServer(message.guildId);

  let wordleNumber: number | null = null;

  // Wordle app posts "yesterday's results", so playedAt is "yesterday" in server's timezone
  const playedAt = getYesterdayInTimezone(message.createdAt, server.timezone ?? 'UTC');

  for (const { discordId, username, score } of parsed.scores) {
    const resolved = await resolveUser(message.guild, { discordId, username });
    log.debug({ discordId, username, resolved }, 'resolved user');

    const user = await getOrCreateUser(server.id, resolved.discordId, resolved.username);

    const game = await recordGame({
      serverId: server.id,
      userId: user.id,
      score,
      messageId: message.id,
      playedAt,
    });

    if (game) {
      log.info({ userId: user.id, wordleNumber: game.wordleNumber, score }, 'recorded game');
      wordleNumber = game.wordleNumber;
    } else {
      log.debug({ userId: user.id, score }, 'duplicate game skipped');
    }
  }

  // Calculate ELO after all games for this wordle are recorded
  if (wordleNumber !== null) {
    try {
      await processWordleElo(server.id, wordleNumber, playedAt);
    } catch (error) {
      log.error({ error, serverId: server.id, wordleNumber }, 'Failed to process ELO');
    }
  }
}
