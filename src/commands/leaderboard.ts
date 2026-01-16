import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { getOrCreateServer } from '@/features/stats';
import { LeaderboardPeriod, getLeaderboard, formatLeaderboardEmbed } from '@/features/leaderboard';

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

    const server = await getOrCreateServer(guildId);
    const leaderboard = await getLeaderboard(server.id, period);

    if (leaderboard.length === 0) {
      await interaction.reply({
        content: 'No games have been played yet.',
        ephemeral: true,
      });
      return;
    }

    const embed = await formatLeaderboardEmbed(interaction.client, leaderboard, period);
    await interaction.reply({ embeds: [embed] });
  },
};
