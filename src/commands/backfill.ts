import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  PermissionFlagsBits,
  type TextChannel,
} from 'discord.js';
import { getOrCreateServer } from '@/features/stats';
import { handleMessage } from '@/features/parser';
import { log } from '@/infrastructure/logger';

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

    log.info({ days, channelId: server.wordleChannelId, cutoffDate }, 'starting backfill');

    let processed = 0;
    let botMessages = 0;
    let lastMessageId: string | undefined;

    while (true) {
      const messages = await textChannel.messages.fetch({
        limit: 100,
        before: lastMessageId,
      });

      log.debug({ fetched: messages.size, before: lastMessageId }, 'fetched messages batch');

      if (messages.size === 0) break;

      for (const message of messages.values()) {
        if (message.createdAt < cutoffDate) {
          log.info({ processed, botMessages }, 'backfill complete (reached cutoff)');
          await interaction.editReply({
            content: `Backfill complete. Processed ${botMessages} bot messages out of ${processed} total.`,
          });
          return;
        }

        processed++;

        if (message.author.bot) {
          botMessages++;
          log.debug({ author: message.author.username, date: message.createdAt }, 'processing bot message');
          await handleMessage(message);
        }

        lastMessageId = message.id;
      }
    }

    log.info({ processed, botMessages }, 'backfill complete (end of channel)');
    await interaction.editReply({
      content: `Backfill complete. Processed ${botMessages} bot messages out of ${processed} total.`,
    });
  },
};
