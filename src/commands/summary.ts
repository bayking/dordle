import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { getOrCreateServer } from '@/features/stats';
import {
  SummaryPeriod,
  generateDailySummary,
  generateWeeklySummary,
  generateMonthlySummary,
} from '@/features/summaries/service';
import {
  formatDailySummaryEmbed,
  formatWeeklySummaryEmbed,
  formatMonthlySummaryEmbed,
} from '@/features/summaries/embeds';

export const summaryCommand = {
  data: new SlashCommandBuilder()
    .setName('summary')
    .setDescription('Show a summary of Wordle results')
    .addStringOption((option) =>
      option
        .setName('period')
        .setDescription('Summary period')
        .setRequired(false)
        .addChoices(
          { name: 'Daily', value: SummaryPeriod.Daily },
          { name: 'Weekly', value: SummaryPeriod.Weekly },
          { name: 'Monthly', value: SummaryPeriod.Monthly }
        )
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const period = (interaction.options.getString('period') ?? SummaryPeriod.Daily) as SummaryPeriod;
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
    const now = new Date();

    let embed;
    switch (period) {
      case SummaryPeriod.Daily: {
        const summary = await generateDailySummary(server.id, now);
        embed = await formatDailySummaryEmbed(interaction.client, summary);
        break;
      }
      case SummaryPeriod.Weekly: {
        const summary = await generateWeeklySummary(server.id, now);
        embed = await formatWeeklySummaryEmbed(interaction.client, summary);
        break;
      }
      case SummaryPeriod.Monthly: {
        const summary = await generateMonthlySummary(server.id, now);
        embed = await formatMonthlySummaryEmbed(interaction.client, summary);
        break;
      }
    }

    await interaction.editReply({ embeds: [embed] });
  },
};
