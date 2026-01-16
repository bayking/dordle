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
        switch (period) {
          case SummaryPeriod.Daily:
            embed = await formatDailySummaryEmbed(client, summary as DailySummary);
            break;
          case SummaryPeriod.Weekly:
            embed = await formatWeeklySummaryEmbed(client, summary as WeeklySummary);
            break;
          case SummaryPeriod.Monthly:
            embed = await formatMonthlySummaryEmbed(client, summary as MonthlySummary);
            break;
        }

        await channel.send({ embeds: [embed] });
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
