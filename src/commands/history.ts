import { SlashCommandBuilder, type ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { getOrCreateServer, getOrCreateUser, getRecentGames } from '@/features/stats/queries';

export const historyCommand = {
  data: new SlashCommandBuilder()
    .setName('history')
    .setDescription('Show recent Wordle game history')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('User to show history for (defaults to yourself)')
        .setRequired(false)
    )
    .addIntegerOption((option) =>
      option
        .setName('count')
        .setDescription('Number of games to show (default: 10, max: 25)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(25)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const targetUser = interaction.options.getUser('user') ?? interaction.user;
    const count = interaction.options.getInteger('count') ?? 10;
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
    const games = await getRecentGames(user.id, count);

    if (games.length === 0) {
      await interaction.reply({
        content: `${targetUser.username} hasn't played any Wordle games yet.`,
        ephemeral: true,
      });
      return;
    }

    const formatScore = (score: number) => (score === 7 ? 'X' : score.toString());
    const history = games
      .map((g) => `#${g.wordleNumber}: **${formatScore(g.score)}/6**`)
      .join('\n');

    const embed = new EmbedBuilder()
      .setTitle(`${targetUser.username}'s Recent Games`)
      .setColor(0x6aaa64)
      .setDescription(history);

    await interaction.reply({ embeds: [embed] });
  },
};
