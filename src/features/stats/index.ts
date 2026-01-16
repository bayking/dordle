import { EmbedBuilder, type User as DiscordUser } from 'discord.js';

export {
  Score,
  getOrCreateServer,
  getOrCreateUser,
  recordGame,
  getRecentGames,
  calculateUserStats,
  type UserStats,
  type ScoreDistribution,
} from '@/features/stats/service';

export { updateServer, deleteServerStats } from '@/features/stats/repository';

import { Score, type UserStats } from '@/features/stats/service';

export function formatStatsEmbed(user: DiscordUser, stats: UserStats): EmbedBuilder {
  const avgDisplay = stats.average !== null ? stats.average.toFixed(2) : 'N/A';
  const formatScore = (score: Score) => (score === Score.Fail ? 'X' : score.toString());

  const distributionBars = ([
    [1, stats.distribution[Score.One]],
    [2, stats.distribution[Score.Two]],
    [3, stats.distribution[Score.Three]],
    [4, stats.distribution[Score.Four]],
    [5, stats.distribution[Score.Five]],
    [6, stats.distribution[Score.Six]],
    ['X', stats.distribution[Score.Fail]],
  ] as const)
    .map(([label, count]) => {
      const bar = '█'.repeat(Math.min(count, 20));
      return `${label}: ${bar} ${count}`;
    })
    .join('\n');

  return new EmbedBuilder()
    .setTitle(`${user.username}'s Wordle Stats`)
    .setColor(0x6aaa64)
    .addFields(
      { name: 'Games', value: stats.totalGames.toString(), inline: true },
      { name: 'Win Rate', value: `${stats.winRate.toFixed(1)}%`, inline: true },
      { name: 'Average', value: avgDisplay, inline: true },
      { name: 'Best', value: formatScore(stats.best), inline: true },
      { name: 'Worst', value: formatScore(stats.worst), inline: true },
      { name: 'Current Streak', value: stats.currentStreak.toString(), inline: true },
      { name: 'Max Streak', value: stats.maxStreak.toString(), inline: true },
      { name: 'Distribution', value: `\`\`\`\n${distributionBars}\n\`\`\`` }
    );
}
