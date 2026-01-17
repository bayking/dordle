import { EmbedBuilder, type Client } from 'discord.js';
import type { DailySummary, WeeklySummary, MonthlySummary, EloChange } from './service';
import { Score } from '@/features/stats';
import { PROVISIONAL_GAMES } from '@/features/elo';

const MEDALS = ['🥇', '🥈', '🥉'];

function formatScore(score: Score): string {
  return score === Score.Fail ? 'X' : score.toString();
}

async function resolveUsername(client: Client, discordId: string, fallback: string | null): Promise<string> {
  if (discordId.startsWith('wordle:')) {
    return fallback ?? 'Unknown';
  }
  try {
    const user = await client.users.fetch(discordId);
    return user.username;
  } catch {
    return fallback ?? discordId;
  }
}

export async function formatDailySummaryEmbed(
  client: Client,
  summary: DailySummary
): Promise<EmbedBuilder> {
  const embed = new EmbedBuilder()
    .setTitle('📊 Daily Wordle Summary')
    .setColor(0x6aaa64);

  if (summary.participants === 0) {
    embed.setDescription('No games played yesterday.');
    return embed;
  }

  const lines: string[] = [];

  if (summary.groupStreak > 0) {
    lines.push(`🔥 **${summary.groupStreak} day streak!**\n`);
  }

  if (summary.winners.length > 0) {
    const winnerNames = await Promise.all(
      summary.winners.map(w => resolveUsername(client, w.discordId, w.wordleUsername))
    );
    const label = summary.winners.length > 1 ? 'Winners' : 'Winner';
    lines.push(`🏆 **${label}:** ${winnerNames.join(', ')} (${formatScore(summary.winners[0]!.score)}/6)\n`);
  }

  const scoresByValue = new Map<Score, typeof summary.scores>();
  for (const score of summary.scores) {
    const existing = scoresByValue.get(score.score) ?? [];
    existing.push(score);
    scoresByValue.set(score.score, existing);
  }

  const sortedScores = [...scoresByValue.entries()].sort((a, b) => a[0] - b[0]);

  for (const [score, players] of sortedScores) {
    const names = await Promise.all(
      players.map(p => resolveUsername(client, p.discordId, p.wordleUsername))
    );
    lines.push(`**${formatScore(score)}/6:** ${names.join(', ')}`);
  }

  // Add ELO changes section if available
  if (summary.eloChanges.length > 0) {
    lines.push('\n**ELO Changes:**');
    for (const change of summary.eloChanges) {
      const name = await resolveUsername(client, change.discordId, change.wordleUsername);
      const arrow = change.change >= 0 ? '📈' : '📉';
      const sign = change.change >= 0 ? '+' : '';
      lines.push(`${arrow} ${name}: ${change.oldElo} → ${change.newElo} (${sign}${change.change})`);
    }
  }

  embed.setDescription(lines.join('\n'));

  if (summary.wordleNumber) {
    embed.setFooter({ text: `Wordle #${summary.wordleNumber}` });
  }

  return embed;
}

export async function formatWeeklySummaryEmbed(
  client: Client,
  summary: WeeklySummary
): Promise<EmbedBuilder> {
  const embed = new EmbedBuilder()
    .setTitle('📈 Weekly Wordle Summary')
    .setColor(0x538d4e);

  if (summary.totalGames === 0) {
    embed.setDescription('No games played this week.');
    return embed;
  }

  const lines: string[] = [
    `**${summary.totalGames}** games played by **${summary.uniquePlayers} players**\n`,
  ];

  // Rankings by ELO
  lines.push('**Rankings:**');
  for (let i = 0; i < Math.min(summary.rankings.length, 10); i++) {
    const player = summary.rankings[i]!;
    const medal = MEDALS[i] ?? `${i + 1}.`;
    const name = await resolveUsername(client, player.discordId, player.wordleUsername);
    const avg = player.average === Infinity ? 'X' : player.average.toFixed(2);
    const streak = player.currentStreak > 0 ? ` 🔥${player.currentStreak}` : '';
    const provisional = player.eloGamesPlayed <= PROVISIONAL_GAMES ? '*' : '';
    const missed = player.missedDays > 0 ? ` (${player.missedDays} missed)` : '';
    lines.push(`${medal} **${name}** - ${player.elo}${provisional} ELO │ ${avg} avg │ ${player.gamesPlayed} games${missed}${streak}`);
  }

  // Top ELO movers
  if (summary.topGainers.length > 0) {
    lines.push('\n**Biggest Gains:**');
    for (const mover of summary.topGainers) {
      const name = await resolveUsername(client, mover.discordId, mover.wordleUsername);
      lines.push(`🚀 ${name}: +${mover.totalChange} ELO (${mover.startElo} → ${mover.endElo})`);
    }
  }

  if (summary.topLosers.length > 0) {
    lines.push('\n**Biggest Drops:**');
    for (const mover of summary.topLosers) {
      const name = await resolveUsername(client, mover.discordId, mover.wordleUsername);
      lines.push(`⬇️ ${name}: ${mover.totalChange} ELO (${mover.startElo} → ${mover.endElo})`);
    }
  }

  embed.setDescription(lines.join('\n'));
  embed.setFooter({ text: '* Provisional rating (< 10 games)' });

  return embed;
}

export async function formatMonthlySummaryEmbed(
  client: Client,
  summary: MonthlySummary
): Promise<EmbedBuilder> {
  const embed = new EmbedBuilder()
    .setTitle('🏆 Monthly Wordle Recap')
    .setColor(0xb59f3b);

  if (summary.totalGames === 0) {
    embed.setDescription('No games played this month.');
    return embed;
  }

  const lines: string[] = [
    `**${summary.totalGames}** total games played\n`,
  ];

  if (summary.champion) {
    const name = await resolveUsername(client, summary.champion.discordId, summary.champion.wordleUsername);
    const avg = summary.champion.average === Infinity ? 'X' : summary.champion.average.toFixed(2);
    lines.push(`👑 **Champion:** ${name}`);
    lines.push(`   ${avg} avg across ${summary.champion.gamesPlayed} games\n`);
  }

  if (summary.bestScore !== null) {
    lines.push(`⭐ **Best Score:** ${formatScore(summary.bestScore)}/6`);
  }

  if (summary.averageScore !== null) {
    lines.push(`📊 **Server Average:** ${summary.averageScore.toFixed(2)}`);
  }

  embed.setDescription(lines.join('\n'));

  return embed;
}
