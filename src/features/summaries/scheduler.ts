import cron from 'node-cron';
import { getDb } from '@/db';
import { scheduledPosts, servers } from '@/db/schema';
import { eq, and, lt } from 'drizzle-orm';
import {
  SummaryPeriod,
  generateDailySummary,
  generateWeeklySummary,
  generateMonthlySummary,
} from '@/features/summaries/service';

export interface SchedulerConfig {
  dailyTime: string; // cron format: '0 9 * * *'
  weeklyDay: number; // 0-6, Sunday = 0
  monthlyDay: number; // 1-31
  onSummaryGenerated: (
    serverId: number,
    channelId: string,
    period: SummaryPeriod,
    summary: unknown
  ) => Promise<void>;
}

interface ScheduledTask {
  stop: () => void;
}

const tasks: ScheduledTask[] = [];

export function startScheduler(config: SchedulerConfig): void {
  // Daily summary at configured time
  const dailyTask = cron.schedule(config.dailyTime, async () => {
    await runDailySummaries(config);
  });
  tasks.push(dailyTask);

  // Weekly summary on configured day at 10:00
  const weeklyTask = cron.schedule(`0 10 * * ${config.weeklyDay}`, async () => {
    await runWeeklySummaries(config);
  });
  tasks.push(weeklyTask);

  // Monthly summary on configured day at 11:00
  const monthlyTask = cron.schedule(`0 11 ${config.monthlyDay} * *`, async () => {
    await runMonthlySummaries(config);
  });
  tasks.push(monthlyTask);
}

export function stopScheduler(): void {
  for (const task of tasks) {
    task.stop();
  }
  tasks.length = 0;
}

export async function checkMissedPosts(config: SchedulerConfig): Promise<void> {
  const db = getDb();
  const now = new Date();

  const allServers = await db.query.servers.findMany();

  for (const server of allServers) {
    if (!server.summaryChannelId) continue;

    const posts = await db.query.scheduledPosts.findMany({
      where: eq(scheduledPosts.serverId, server.id),
    });

    for (const post of posts) {
      const missedTime = getMissedTime(post.type as SummaryPeriod, post.lastPostedAt, now);

      if (missedTime) {
        await runSummaryForServer(server.id, server.summaryChannelId, post.type as SummaryPeriod, config);
        await updateLastPostedAt(server.id, post.type as SummaryPeriod, now);
      }
    }
  }
}

function getMissedTime(
  period: SummaryPeriod,
  lastPosted: Date | null,
  now: Date
): boolean {
  if (!lastPosted) return true;

  const hoursSinceLastPost = (now.getTime() - lastPosted.getTime()) / (1000 * 60 * 60);

  switch (period) {
    case SummaryPeriod.Daily:
      return hoursSinceLastPost > 24;
    case SummaryPeriod.Weekly:
      return hoursSinceLastPost > 24 * 7;
    case SummaryPeriod.Monthly:
      return hoursSinceLastPost > 24 * 28;
    default:
      return false;
  }
}

async function runDailySummaries(config: SchedulerConfig): Promise<void> {
  const db = getDb();
  const allServers = await db.query.servers.findMany();

  for (const server of allServers) {
    if (!server.summaryChannelId) continue;

    await runSummaryForServer(server.id, server.summaryChannelId, SummaryPeriod.Daily, config);
    await updateLastPostedAt(server.id, SummaryPeriod.Daily, new Date());
  }
}

async function runWeeklySummaries(config: SchedulerConfig): Promise<void> {
  const db = getDb();
  const allServers = await db.query.servers.findMany();

  for (const server of allServers) {
    if (!server.summaryChannelId) continue;

    await runSummaryForServer(server.id, server.summaryChannelId, SummaryPeriod.Weekly, config);
    await updateLastPostedAt(server.id, SummaryPeriod.Weekly, new Date());
  }
}

async function runMonthlySummaries(config: SchedulerConfig): Promise<void> {
  const db = getDb();
  const allServers = await db.query.servers.findMany();

  for (const server of allServers) {
    if (!server.summaryChannelId) continue;

    await runSummaryForServer(server.id, server.summaryChannelId, SummaryPeriod.Monthly, config);
    await updateLastPostedAt(server.id, SummaryPeriod.Monthly, new Date());
  }
}

async function runSummaryForServer(
  serverId: number,
  channelId: string,
  period: SummaryPeriod,
  config: SchedulerConfig
): Promise<void> {
  const now = new Date();

  let summary: unknown;
  switch (period) {
    case SummaryPeriod.Daily:
      summary = await generateDailySummary(serverId, now);
      break;
    case SummaryPeriod.Weekly:
      summary = await generateWeeklySummary(serverId, now);
      break;
    case SummaryPeriod.Monthly:
      summary = await generateMonthlySummary(serverId, now);
      break;
  }

  await config.onSummaryGenerated(serverId, channelId, period, summary);
}

async function updateLastPostedAt(
  serverId: number,
  type: SummaryPeriod,
  date: Date
): Promise<void> {
  const db = getDb();

  await db
    .insert(scheduledPosts)
    .values({
      serverId,
      type,
      lastPostedAt: date,
    })
    .onConflictDoUpdate({
      target: [scheduledPosts.serverId, scheduledPosts.type],
      set: { lastPostedAt: date },
    });
}
