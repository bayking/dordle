import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { getOrCreateServer, getOrCreateUser } from '@/features/stats/queries';
import { calculateUserStats, formatStatsEmbed } from '@/features/stats';

export const statsCommand = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Show Wordle statistics for a user')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('User to show stats for (defaults to yourself)')
        .setRequired(false)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const targetUser = interaction.options.getUser('user') ?? interaction.user;
    const guildId = interaction.guildId;

    if (!guildId) {
      await interaction.reply({
        content: 'This command can only be used in a server.',
        ephemeral: true,
      });
      return;
    }

    const server = await getOrCreateServer(guildId);
    const user = await getOrCreateUser(server.id, targetUser.id);
    const stats = await calculateUserStats(user.id);

    if (!stats) {
      await interaction.reply({
        content: `${targetUser.username} hasn't played any Wordle games yet.`,
        ephemeral: true,
      });
      return;
    }

    const embed = formatStatsEmbed(targetUser, stats);
    await interaction.reply({ embeds: [embed] });
  },
};
