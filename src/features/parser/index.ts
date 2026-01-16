import type { Message } from 'discord.js';
import { parseWordleMessage } from '@/features/parser/patterns';
import { resolveUser } from '@/features/parser/resolver';
import { getOrCreateServer, getOrCreateUser, recordGame } from '@/features/stats';
import { log } from '@/infrastructure/logger';

export { parseWordleMessage } from '@/features/parser/patterns';
export type { ParsedResult, ParsedScore } from '@/features/parser/patterns';
export { resolveUser } from '@/features/parser/resolver';

const WORDLE_APP_USERNAME = 'Wordle';

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

  for (const { discordId, username, score } of parsed.scores) {
    const resolved = await resolveUser(message.guild, { discordId, username });
    log.debug({ discordId, username, resolved }, 'resolved user');

    const user = await getOrCreateUser(server.id, resolved.discordId, resolved.username);

    const game = await recordGame({
      serverId: server.id,
      userId: user.id,
      score,
      messageId: message.id,
    });

    if (game) {
      log.info({ userId: user.id, wordleNumber: game.wordleNumber, score }, 'recorded game');
    } else {
      log.debug({ userId: user.id, score }, 'duplicate game skipped');
    }
  }
}
