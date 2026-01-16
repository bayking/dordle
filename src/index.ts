import { AttachmentBuilder } from 'discord.js';
import { validateConfig } from '@/config';
import { initializeDb } from '@/db';
import { startBot } from '@/bot';
import {
  startScheduler,
  checkMissedPosts,
  SummaryPeriod,
  formatDailySummaryEmbed,
  formatWeeklySummaryEmbed,
  formatMonthlySummaryEmbed,
  type DailySummary,
  type WeeklySummary,
  type MonthlySummary,
} from '@/features/summaries';
import { generateLeaderboardChart, type LeaderboardChartEntry } from '@/features/charts';
import { log } from '@/infrastructure/logger';

async function main(): Promise<void> {
  try {
    validateConfig();
    initializeDb();

    const client = await startBot();

    const schedulerConfig = {
      dailyTime: '0 9 * * *',
      dailyHour: 9,
      weeklyDay: 0,
      weeklyHour: 10,
      monthlyDay: 1,
      monthlyHour: 11,
      onSummaryGenerated: async (serverId: number, channelId: string, period: SummaryPeriod, summary: unknown) => {
        const channel = await client.channels.fetch(channelId);
        if (!channel?.isTextBased()) return;

        log.info({ serverId, channelId, period }, 'sending summary');

        let embed;
        let chartBuffer: Buffer | null = null;

        switch (period) {
          case SummaryPeriod.Daily:
            embed = await formatDailySummaryEmbed(client, summary as DailySummary);
            break;
          case SummaryPeriod.Weekly: {
            const weeklySummary = summary as WeeklySummary;
            embed = await formatWeeklySummaryEmbed(client, weeklySummary);
            if (weeklySummary.rankings.length > 0) {
              const chartEntries: LeaderboardChartEntry[] = await Promise.all(
                weeklySummary.rankings.slice(0, 10).map(async (r) => {
                  let name = r.wordleUsername ?? 'Unknown';
                  if (!r.discordId.startsWith('wordle:')) {
                    try {
                      const user = await client.users.fetch(r.discordId);
                      name = user.username;
                    } catch { /* keep fallback */ }
                  }
                  return { name, average: r.average, gamesPlayed: r.gamesPlayed };
                })
              );
              chartBuffer = await generateLeaderboardChart(chartEntries, 'Weekly Leaderboard');
            }
            break;
          }
          case SummaryPeriod.Monthly: {
            const monthlySummary = summary as MonthlySummary;
            embed = await formatMonthlySummaryEmbed(client, monthlySummary);
            break;
          }
        }

        const files = chartBuffer
          ? [new AttachmentBuilder(chartBuffer, { name: 'leaderboard.png' })]
          : [];

        await channel.send({ embeds: [embed], files });
      },
    };

    startScheduler(schedulerConfig);
    await checkMissedPosts(schedulerConfig);

    log.info('Dordle is running!');
  } catch (error) {
    log.error({ error }, 'Failed to start Dordle');
    process.exit(1);
  }
}

main();
