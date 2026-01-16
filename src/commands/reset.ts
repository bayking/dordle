import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { getOrCreateServer, deleteServerStats } from '@/features/stats';

export const resetCommand = {
  data: new SlashCommandBuilder()
    .setName('reset')
    .setDescription('Reset all Wordle statistics for this server (admin only)')
    .addStringOption((option) =>
      option
        .setName('confirm')
        .setDescription('Type "CONFIRM" to proceed with reset')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const guildId = interaction.guildId;

    if (!guildId) {
      await interaction.reply({
        content: 'This command can only be used in a server.',
        ephemeral: true,
      });
      return;
    }

    const confirm = interaction.options.getString('confirm', true);

    if (confirm !== 'CONFIRM') {
      await interaction.reply({
        content: 'Reset cancelled. To reset all stats, use `/reset confirm:CONFIRM`',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    const server = await getOrCreateServer(guildId);
    const { gamesDeleted, usersDeleted } = await deleteServerStats(server.id);

    await interaction.editReply({
      content: `Reset complete. Deleted ${gamesDeleted} games and ${usersDeleted} users.`,
    });
  },
};
