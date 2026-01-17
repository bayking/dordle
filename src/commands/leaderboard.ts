import { SlashCommandBuilder, AttachmentBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { getOrCreateServer } from '@/features/stats';
import { LeaderboardPeriod, getLeaderboard, formatLeaderboardEmbed } from '@/features/leaderboard';
import { generateLeaderboardChart, type LeaderboardChartEntry } from '@/features/charts';
import { findEloHistoryForUsers } from '@/features/charts/repository';

const PERIOD_TITLES: Record<LeaderboardPeriod, string> = {
  [LeaderboardPeriod.AllTime]: 'All-Time Leaderboard',
  [LeaderboardPeriod.Weekly]: 'Weekly Leaderboard',
  [LeaderboardPeriod.Monthly]: 'Monthly Leaderboard',
};

export const leaderboardCommand = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Show the server Wordle leaderboard')
    .addStringOption((option) =>
      option
        .setName('period')
        .setDescription('Time period for the leaderboard')
        .setRequired(false)
        .addChoices(
          { name: 'All Time', value: LeaderboardPeriod.AllTime },
          { name: 'This Week', value: LeaderboardPeriod.Weekly },
          { name: 'This Month', value: LeaderboardPeriod.Monthly }
        )
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const period = (interaction.options.getString('period') ?? LeaderboardPeriod.AllTime) as LeaderboardPeriod;
    const guildId = interaction.guildId;

    if (!guildId) {
      await interaction.reply({
        content: 'This command can only be used in a server.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    const server = await getOrCreateServer(guildId);
    const leaderboard = await getLeaderboard(server.id, period);

    if (leaderboard.length === 0) {
      await interaction.editReply({
        content: 'No games have been played yet.',
      });
      return;
    }

    // Get ELO history for top 10 players
    const top10 = leaderboard.slice(0, 10);
    const userIds = top10.map((e) => e.userId);
    const eloHistoryMap = await findEloHistoryForUsers(server.id, userIds);

    // Resolve usernames and build chart entries
    const chartEntries: LeaderboardChartEntry[] = await Promise.all(
      top10.map(async (entry) => {
        let name = entry.wordleUsername ?? 'Unknown';
        if (!entry.discordId.startsWith('wordle:')) {
          try {
            const user = await interaction.client.users.fetch(entry.discordId);
            name = user.username;
          } catch {
            // Keep wordleUsername or Unknown
          }
        }
        return {
          name,
          eloHistory: eloHistoryMap.get(entry.userId) ?? [],
          currentElo: entry.elo,
        };
      })
    );

    const [embed, chartBuffer] = await Promise.all([
      formatLeaderboardEmbed(interaction.client, leaderboard, period),
      generateLeaderboardChart(chartEntries, `${PERIOD_TITLES[period]} - ELO Trend`),
    ]);

    const attachment = new AttachmentBuilder(chartBuffer, { name: 'leaderboard.png' });

    await interaction.editReply({ embeds: [embed], files: [attachment] });
  },
};
