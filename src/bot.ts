import {
  Client,
  GatewayIntentBits,
  Events,
  REST,
  Routes,
  type ChatInputCommandInteraction,
  type Message,
} from 'discord.js';
import { config } from '@/config';
import { commands, handleCommand } from '@/commands';
import { handleMessage } from '@/features/parser';

export function createClient(): Client {
  return new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });
}

export async function registerCommands(): Promise<void> {
  const rest = new REST().setToken(config.discord.token);

  const commandData = commands.map((cmd) => cmd.data.toJSON());

  await rest.put(Routes.applicationCommands(config.discord.applicationId), {
    body: commandData,
  });

  console.log(`Registered ${commandData.length} slash commands`);
}

export function setupEventHandlers(client: Client): void {
  client.once(Events.ClientReady, (readyClient) => {
    console.log(`Logged in as ${readyClient.user.tag}`);
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    await handleCommand(interaction as ChatInputCommandInteraction);
  });

  client.on(Events.MessageCreate, async (message: Message) => {
    if (message.author.bot) {
      await handleMessage(message);
    }
  });
}

export async function startBot(): Promise<Client> {
  const client = createClient();

  await registerCommands();
  setupEventHandlers(client);
  await client.login(config.discord.token);

  return client;
}
