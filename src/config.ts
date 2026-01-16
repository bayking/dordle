export const config = {
  discord: {
    token: process.env.DISCORD_BOT_TOKEN ?? '',
    applicationId: process.env.DISCORD_APPLICATION_ID ?? '',
  },
  database: {
    path: process.env.DATABASE_PATH ?? './data/dordle.db',
  },
} as const;

export function validateConfig(): void {
  if (!config.discord.token) {
    throw new Error('DISCORD_BOT_TOKEN is required');
  }
  if (!config.discord.applicationId) {
    throw new Error('DISCORD_APPLICATION_ID is required');
  }
}
