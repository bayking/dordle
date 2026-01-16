import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
} from 'discord.js';
import { getOrCreateServer, updateServer } from '@/features/stats';

export const configCommand = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configure Dordle settings (admin only)')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('channel')
        .setDescription('Set the Wordle tracking channel')
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('Channel where Wordle results are posted')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('summary')
        .setDescription('Set the summary post channel')
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('Channel where summaries will be posted')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('timezone')
        .setDescription('Set the server timezone')
        .addStringOption((option) =>
          option
            .setName('timezone')
            .setDescription('Timezone (e.g., America/New_York, Europe/London)')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('show').setDescription('Show current configuration')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (!guildId) {
      await interaction.reply({
        content: 'This command can only be used in a server.',
        ephemeral: true,
      });
      return;
    }

    const server = await getOrCreateServer(guildId);

    switch (subcommand) {
      case 'channel': {
        const channel = interaction.options.getChannel('channel', true);
        await updateServer(server.id, { wordleChannelId: channel.id });
        await interaction.reply({
          content: `Wordle tracking channel set to <#${channel.id}>`,
          ephemeral: true,
        });
        break;
      }

      case 'summary': {
        const channel = interaction.options.getChannel('channel', true);
        await updateServer(server.id, { summaryChannelId: channel.id });
        await interaction.reply({
          content: `Summary channel set to <#${channel.id}>`,
          ephemeral: true,
        });
        break;
      }

      case 'timezone': {
        const timezone = interaction.options.getString('timezone', true);
        try {
          Intl.DateTimeFormat(undefined, { timeZone: timezone });
        } catch {
          await interaction.reply({
            content: `Invalid timezone: ${timezone}`,
            ephemeral: true,
          });
          return;
        }
        await updateServer(server.id, { timezone });
        await interaction.reply({
          content: `Timezone set to ${timezone}`,
          ephemeral: true,
        });
        break;
      }

      case 'show': {
        const wordleChannel = server.wordleChannelId
          ? `<#${server.wordleChannelId}>`
          : 'Not set';
        const summaryChannel = server.summaryChannelId
          ? `<#${server.summaryChannelId}>`
          : 'Not set';
        await interaction.reply({
          content: [
            '**Current Configuration**',
            `Wordle Channel: ${wordleChannel}`,
            `Summary Channel: ${summaryChannel}`,
            `Timezone: ${server.timezone}`,
          ].join('\n'),
          ephemeral: true,
        });
        break;
      }
    }
  },
};
