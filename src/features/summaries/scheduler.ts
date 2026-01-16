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
import {
  getInactiveUsers,
  applyEloDecay,
  DECAY_THRESHOLD_DAYS,
  DECAY_AMOUNT,
} from '@/features/elo';
import { log } from '@/infrastructure/logger';

export function isTargetHourInTimezone(date: Date, timezone: string, targetHour: number): boolean {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    });
    const hour = parseInt(formatter.format(date), 10);
    return hour === targetHour;
  } catch {
    // Invalid timezone, default to UTC
    return date.getUTCHours() === targetHour;
  }
}

export function getDayOfWeekInTimezone(date: Date, timezone: string): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
    });
    const dayStr = formatter.format(date);
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days.indexOf(dayStr);
  } catch {
    return date.getUTCDay();
  }
}

export function getDayOfMonthInTimezone(date: Date, timezone: string): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      day: 'numeric',
    });
    return parseInt(formatter.format(date), 10);
  } catch {
    return date.getUTCDate();
  }
}

export interface SchedulerConfig {
  dailyTime: string; // cron format: '0 9 * * *'
  dailyHour: number; // hour to post daily summaries (0-23)
  weeklyDay: number; // 0-6, Sunday = 0
  weeklyHour: number; // hour to post weekly summaries (0-23)
  monthlyDay: number; // 1-31
  monthlyHour: number; // hour to post monthly summaries (0-23)
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
  // Run every hour to check each server's timezone
  const hourlyTask = cron.schedule('0 * * * *', async () => {
    const now = new Date();
    await runDailySummaries(config, now);
    await runWeeklySummaries(config, now);
    await runMonthlySummaries(config, now);
  });
  tasks.push(hourlyTask);
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

async function runDailySummaries(config: SchedulerConfig, now: Date): Promise<void> {
  const db = getDb();
  const allServers = await db.query.servers.findMany();

  for (const server of allServers) {
    if (!server.summaryChannelId) continue;

    const timezone = server.timezone ?? 'UTC';
    if (!isTargetHourInTimezone(now, timezone, config.dailyHour)) continue;

    await runSummaryForServer(server.id, server.summaryChannelId, SummaryPeriod.Daily, config, now);
    await updateLastPostedAt(server.id, SummaryPeriod.Daily, now);
  }
}

async function runWeeklySummaries(config: SchedulerConfig, now: Date): Promise<void> {
  const db = getDb();
  const allServers = await db.query.servers.findMany();

  for (const server of allServers) {
    if (!server.summaryChannelId) continue;

    const timezone = server.timezone ?? 'UTC';
    const dayOfWeek = getDayOfWeekInTimezone(now, timezone);
    if (dayOfWeek !== config.weeklyDay) continue;
    if (!isTargetHourInTimezone(now, timezone, config.weeklyHour)) continue;

    // Apply ELO decay for inactive users
    await applyWeeklyEloDecay(server.id, now);

    await runSummaryForServer(server.id, server.summaryChannelId, SummaryPeriod.Weekly, config, now);
    await updateLastPostedAt(server.id, SummaryPeriod.Weekly, now);
  }
}

async function applyWeeklyEloDecay(serverId: number, now: Date): Promise<void> {
  const inactiveSince = new Date(now.getTime() - DECAY_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);
  const inactiveUsers = await getInactiveUsers(serverId, inactiveSince);

  if (inactiveUsers.length > 0) {
    const userIds = inactiveUsers.map((u) => u.id);
    await applyEloDecay(userIds, DECAY_AMOUNT);
    log.info(
      { serverId, usersDecayed: userIds.length, decayAmount: DECAY_AMOUNT },
      'Applied weekly ELO decay'
    );
  }
}

async function runMonthlySummaries(config: SchedulerConfig, now: Date): Promise<void> {
  const db = getDb();
  const allServers = await db.query.servers.findMany();

  for (const server of allServers) {
    if (!server.summaryChannelId) continue;

    const timezone = server.timezone ?? 'UTC';
    const dayOfMonth = getDayOfMonthInTimezone(now, timezone);
    if (dayOfMonth !== config.monthlyDay) continue;
    if (!isTargetHourInTimezone(now, timezone, config.monthlyHour)) continue;

    await runSummaryForServer(server.id, server.summaryChannelId, SummaryPeriod.Monthly, config, now);
    await updateLastPostedAt(server.id, SummaryPeriod.Monthly, now);
  }
}

async function runSummaryForServer(
  serverId: number,
  channelId: string,
  period: SummaryPeriod,
  config: SchedulerConfig,
  now: Date = new Date()
): Promise<void> {
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
