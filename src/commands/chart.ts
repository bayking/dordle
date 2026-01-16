import { SlashCommandBuilder, type ChatInputCommandInteraction, AttachmentBuilder } from 'discord.js';
import { getOrCreateServer, getOrCreateUser } from '@/features/stats/queries';
import { calculateUserStats } from '@/features/stats';
import { generateDistributionChart, generateTrendChart } from '@/features/charts';

export type ChartType = 'distribution' | 'trend';

export const chartCommand = {
  data: new SlashCommandBuilder()
    .setName('chart')
    .setDescription('Generate a stats chart')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('User to show chart for (defaults to yourself)')
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName('type')
        .setDescription('Type of chart to generate')
        .setRequired(false)
        .addChoices(
          { name: 'Score Distribution', value: 'distribution' },
          { name: 'Score Trend', value: 'trend' }
        )
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const targetUser = interaction.options.getUser('user') ?? interaction.user;
    const chartType = (interaction.options.getString('type') ?? 'distribution') as ChartType;
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
    const user = await getOrCreateUser(server.id, targetUser.id);
    const stats = await calculateUserStats(user.id);

    if (!stats) {
      await interaction.editReply({
        content: `${targetUser.username} hasn't played any Wordle games yet.`,
      });
      return;
    }

    const chartBuffer =
      chartType === 'distribution'
        ? await generateDistributionChart(stats.distribution, targetUser.username)
        : await generateTrendChart(user.id, targetUser.username);

    const attachment = new AttachmentBuilder(chartBuffer, {
      name: `${chartType}-chart.png`,
    });

    await interaction.editReply({ files: [attachment] });
  },
};
