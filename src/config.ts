import dotenv from 'dotenv';

dotenv.config();

export const config = {
  discord: {
    token: process.env.DISCORD_TOKEN || '',
    clientId: process.env.DISCORD_CLIENT_ID || '',
  },
  database: {
    path: process.env.DATABASE_PATH || './data/dordle.db',
  },
} as const;

export function validateConfig(): void {
  if (!config.discord.token) {
    throw new Error('DISCORD_TOKEN is required');
  }
  if (!config.discord.clientId) {
    throw new Error('DISCORD_CLIENT_ID is required');
  }
}
