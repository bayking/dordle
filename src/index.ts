import { validateConfig } from '@/config';
import { initializeDb } from '@/db';
import { startBot } from '@/bot';
import { startScheduler, checkMissedPosts } from '@/features/summaries';

async function main(): Promise<void> {
  try {
    validateConfig();
    initializeDb();

    const client = await startBot();

    startScheduler({
      dailyTime: '0 9 * * *',
      weeklyDay: 0,
      monthlyDay: 1,
      onSummaryGenerated: async (serverId, channelId, period, summary) => {
        const channel = await client.channels.fetch(channelId);
        if (channel?.isTextBased()) {
          await channel.send(`Summary generated for period: ${period}`);
        }
      },
    });

    await checkMissedPosts({
      dailyTime: '0 9 * * *',
      weeklyDay: 0,
      monthlyDay: 1,
      onSummaryGenerated: async (serverId, channelId, period, summary) => {
        const channel = await client.channels.fetch(channelId);
        if (channel?.isTextBased()) {
          await channel.send(`Missed summary recovered for period: ${period}`);
        }
      },
    });

    console.log('Dordle is running!');
  } catch (error) {
    console.error('Failed to start Dordle:', error);
    process.exit(1);
  }
}

main();
