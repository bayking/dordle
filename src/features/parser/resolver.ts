import type { Guild } from 'discord.js';

export interface ResolvedUser {
  discordId: string;
  username: string;
}

export interface UserInput {
  discordId?: string;
  username?: string;
}

export async function resolveUser(
  guild: Guild,
  input: UserInput
): Promise<ResolvedUser> {
  // If both provided, return directly
  if (input.discordId && input.username) {
    return {
      discordId: input.discordId,
      username: input.username,
    };
  }

  // If only discordId, fetch username from Discord
  if (input.discordId) {
    try {
      const member = await guild.members.fetch(input.discordId);
      return {
        discordId: input.discordId,
        username: member.user.displayName,
      };
    } catch {
      return {
        discordId: input.discordId,
        username: input.discordId,
      };
    }
  }

  // If only username, search for member
  if (input.username) {
    try {
      const members = await guild.members.fetch({ query: input.username, limit: 1 });
      const member = members.first();
      if (member) {
        return {
          discordId: member.id,
          username: input.username,
        };
      }
    } catch {
      // Fall through to default
    }

    return {
      discordId: `wordle:${input.username}`,
      username: input.username,
    };
  }

  throw new Error('Either discordId or username must be provided');
}
