import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  PermissionFlagsBits,
  type TextChannel,
} from 'discord.js';
import { getOrCreateServer } from '@/features/stats';
import { handleMessage } from '@/features/parser';

export const backfillCommand = {
  data: new SlashCommandBuilder()
    .setName('backfill')
    .setDescription('Parse historical Wordle messages (admin only)')
    .addIntegerOption((option) =>
      option
        .setName('days')
        .setDescription('Number of days to backfill (default: 7, max: 90)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(90)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const days = interaction.options.getInteger('days') ?? 7;
    const guildId = interaction.guildId;

    if (!guildId) {
      await interaction.reply({
        content: 'This command can only be used in a server.',
        ephemeral: true,
      });
      return;
    }

    const server = await getOrCreateServer(guildId);

    if (!server.wordleChannelId) {
      await interaction.reply({
        content: 'No Wordle channel configured. Use `/config channel` first.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    const channel = await interaction.client.channels.fetch(server.wordleChannelId);
    if (!channel?.isTextBased()) {
      await interaction.editReply({
        content: 'Configured Wordle channel not found or not a text channel.',
      });
      return;
    }

    const textChannel = channel as TextChannel;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    let processed = 0;
    let lastMessageId: string | undefined;

    while (true) {
      const messages = await textChannel.messages.fetch({
        limit: 100,
        before: lastMessageId,
      });

      if (messages.size === 0) break;

      for (const message of messages.values()) {
        if (message.createdAt < cutoffDate) {
          await interaction.editReply({
            content: `Backfill complete. Processed ${processed} messages.`,
          });
          return;
        }

        if (message.author.bot) {
          await handleMessage(message);
          processed++;
        }

        lastMessageId = message.id;
      }
    }

    await interaction.editReply({
      content: `Backfill complete. Processed ${processed} messages.`,
    });
  },
};
