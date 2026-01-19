import {
  type ChatInputCommandInteraction,
  type SlashCommandBuilder,
} from 'discord.js';
import { statsCommand } from '@/commands/stats';
import { leaderboardCommand } from '@/commands/leaderboard';
import { compareCommand } from '@/commands/compare';
import { historyCommand } from '@/commands/history';
import { chartCommand } from '@/commands/chart';
import { backfillCommand } from '@/commands/backfill';
import { configCommand } from '@/commands/config';
import { resetCommand } from '@/commands/reset';
import { summaryCommand } from '@/commands/summary';

export interface Command {
  data: SlashCommandBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

export const commands: Command[] = [
  statsCommand,
  leaderboardCommand,
  compareCommand,
  historyCommand,
  chartCommand,
  backfillCommand,
  configCommand,
  resetCommand,
  summaryCommand,
];

const commandMap = new Map<string, Command>(
  commands.map((cmd) => [cmd.data.name, cmd])
);

export async function handleCommand(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const command = commandMap.get(interaction.commandName);

  if (!command) {
    await interaction.reply({
      content: 'Unknown command',
      ephemeral: true,
    });
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`Error executing ${interaction.commandName}:`, error);

    const reply = {
      content: 'An error occurred while executing this command.',
      ephemeral: true,
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply);
    } else {
      await interaction.reply(reply);
    }
  }
}
