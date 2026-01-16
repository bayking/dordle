import { EmbedBuilder, type Client } from 'discord.js';

export {
  LeaderboardPeriod,
  getLeaderboard,
  type LeaderboardEntry,
} from '@/features/leaderboard/service';

import { LeaderboardPeriod, type LeaderboardEntry } from '@/features/leaderboard/service';
import { PROVISIONAL_GAMES } from '@/features/elo';

const PERIOD_TITLES: Record<LeaderboardPeriod, string> = {
  [LeaderboardPeriod.AllTime]: 'All-Time Leaderboard',
  [LeaderboardPeriod.Weekly]: 'Weekly Leaderboard',
  [LeaderboardPeriod.Monthly]: 'Monthly Leaderboard',
};

const RANK_MEDALS = ['🥇', '🥈', '🥉'];

export async function formatLeaderboardEmbed(
  client: Client,
  entries: LeaderboardEntry[],
  period: LeaderboardPeriod
): Promise<EmbedBuilder> {
  const lines: string[] = [];

  for (const entry of entries.slice(0, 10)) {
    const medal = entry.rank <= 3 ? RANK_MEDALS[entry.rank - 1] : `${entry.rank}.`;
    const name = await resolveUsername(client, entry);
    const avg = entry.average === Infinity ? 'N/A' : entry.average.toFixed(2);
    const streak = entry.currentStreak > 0 ? ` 🔥${entry.currentStreak}` : '';
    const provisional = entry.eloGamesPlayed <= PROVISIONAL_GAMES ? '*' : '';

    lines.push(
      `${medal} **${name}** - ${entry.elo}${provisional} ELO │ ${avg} avg │ ${entry.gamesPlayed} games${streak}`
    );
  }

  return new EmbedBuilder()
    .setTitle(PERIOD_TITLES[period])
    .setColor(0x6aaa64)
    .setDescription(lines.join('\n') || 'No games played yet.')
    .setFooter({ text: '* Provisional rating (< 10 games)' });
}

async function resolveUsername(client: Client, entry: LeaderboardEntry): Promise<string> {
  if (entry.discordId.startsWith('wordle:')) {
    return entry.wordleUsername ?? 'Unknown';
  }

  try {
    const user = await client.users.fetch(entry.discordId);
    return user.username;
  } catch {
    return entry.wordleUsername ?? 'Unknown';
  }
}
