import type { Message } from 'discord.js';
import { parseWordleMessage } from '@/features/parser/patterns';
import { getOrCreateServer, getOrCreateUser, recordGame } from '@/features/stats';

export { parseWordleMessage } from '@/features/parser/patterns';
export type { ParsedResult, ParsedScore } from '@/features/parser/patterns';

const WORDLE_APP_USERNAME = 'Wordle';

export async function handleMessage(message: Message): Promise<void> {
  if (!message.guildId) return;
  if (message.author.username !== WORDLE_APP_USERNAME) return;

  const parsed = parseWordleMessage(message.content);
  if (!parsed) return;

  const server = await getOrCreateServer(message.guildId);

  for (const { discordId, username, score } of parsed.scores) {
    const user = await getOrCreateUser(server.id, discordId, username);
    await recordGame({
      serverId: server.id,
      userId: user.id,
      score,
      messageId: message.id,
    });
  }
}
