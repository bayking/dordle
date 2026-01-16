import { SlashCommandBuilder, type ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { getOrCreateServer, getOrCreateUser } from '@/features/stats/queries';
import { calculateUserStats } from '@/features/stats';

export const compareCommand = {
  data: new SlashCommandBuilder()
    .setName('compare')
    .setDescription('Compare Wordle stats between two users')
    .addUserOption((option) =>
      option
        .setName('user1')
        .setDescription('First user to compare')
        .setRequired(true)
    )
    .addUserOption((option) =>
      option
        .setName('user2')
        .setDescription('Second user to compare')
        .setRequired(true)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const user1 = interaction.options.getUser('user1', true);
    const user2 = interaction.options.getUser('user2', true);
    const guildId = interaction.guildId;

    if (!guildId) {
      await interaction.reply({
        content: 'This command can only be used in a server.',
        ephemeral: true,
      });
      return;
    }

    const server = await getOrCreateServer(guildId);
    const dbUser1 = await getOrCreateUser(server.id, user1.id);
    const dbUser2 = await getOrCreateUser(server.id, user2.id);

    const [stats1, stats2] = await Promise.all([
      calculateUserStats(dbUser1.id),
      calculateUserStats(dbUser2.id),
    ]);

    if (!stats1 || !stats2) {
      const missing = !stats1 ? user1.username : user2.username;
      await interaction.reply({
        content: `${missing} hasn't played any Wordle games yet.`,
        ephemeral: true,
      });
      return;
    }

    const better = (a: number, b: number, lower = true) => {
      if (a === b) return '=';
      return lower ? (a < b ? '◀' : '▶') : (a > b ? '◀' : '▶');
    };

    const embed = new EmbedBuilder()
      .setTitle(`${user1.username} vs ${user2.username}`)
      .setColor(0x6aaa64)
      .addFields(
        {
          name: 'Games',
          value: `${stats1.totalGames} ${better(stats1.totalGames, stats2.totalGames, false)} ${stats2.totalGames}`,
          inline: true,
        },
        {
          name: 'Win Rate',
          value: `${stats1.winRate.toFixed(1)}% ${better(stats1.winRate, stats2.winRate, false)} ${stats2.winRate.toFixed(1)}%`,
          inline: true,
        },
        {
          name: 'Average',
          value: `${stats1.average.toFixed(2)} ${better(stats1.average, stats2.average)} ${stats2.average.toFixed(2)}`,
          inline: true,
        },
        {
          name: 'Best',
          value: `${stats1.best} ${better(stats1.best, stats2.best)} ${stats2.best}`,
          inline: true,
        },
        {
          name: 'Current Streak',
          value: `${stats1.currentStreak} ${better(stats1.currentStreak, stats2.currentStreak, false)} ${stats2.currentStreak}`,
          inline: true,
        },
        {
          name: 'Max Streak',
          value: `${stats1.maxStreak} ${better(stats1.maxStreak, stats2.maxStreak, false)} ${stats2.maxStreak}`,
          inline: true,
        }
      );

    await interaction.reply({ embeds: [embed] });
  },
};
