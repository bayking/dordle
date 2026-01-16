# Dordle

A self-hostable Discord bot that tracks Wordle statistics from the official Wordle Discord app.

## Features

- **Automatic Score Tracking** - Listens to Wordle app messages and records scores
- **User Statistics** - Win rate, average score, streaks, score distribution
- **Leaderboards** - All-time, weekly, and monthly rankings
- **Charts** - Visual score distribution and trend charts
- **Auto Summaries** - Daily, weekly, and monthly summary posts
- **Backfill** - Import historical scores from channel history

## Requirements

- [Bun](https://bun.sh) v1.0+
- Discord Bot Token

## Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/dordle.git
cd dordle
```

2. Install dependencies:
```bash
bun install
```

3. Create `.env` file:
```bash
cp .env.example .env
```

4. Configure environment variables:
```
DISCORD_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_client_id
DATABASE_PATH=./data/dordle.db
```

5. Start the bot:
```bash
bun start
```

## Discord Bot Setup

1. Create a new application at [Discord Developer Portal](https://discord.com/developers/applications)
2. Navigate to **Bot** and create a bot
3. Enable these **Privileged Gateway Intents**:
   - Message Content Intent
4. Copy the bot token to your `.env` file
5. Navigate to **OAuth2 > URL Generator**:
   - Select scopes: `bot`, `applications.commands`
   - Select permissions: `Send Messages`, `Read Message History`, `Attach Files`
6. Use the generated URL to invite the bot to your server

## Commands

| Command | Description |
|---------|-------------|
| `/stats [user]` | View user statistics |
| `/leaderboard [period]` | Server leaderboard (all-time/weekly/monthly) |
| `/compare @user1 @user2` | Head-to-head comparison |
| `/history [user] [count]` | Recent game history |
| `/chart [user] [type]` | Generate stats chart |
| `/config channel` | Set Wordle tracking channel (admin) |
| `/config summary` | Set summary post channel (admin) |
| `/backfill [days]` | Import historical messages (admin) |

## Docker Deployment

```bash
docker compose up -d
```

Or build manually:
```bash
docker build -t dordle .
docker run -d --env-file .env -v ./data:/app/data dordle
```

## Development

Run tests:
```bash
bun run test
```

Run in development mode:
```bash
bun run dev
```

## Tech Stack

- **Runtime**: Bun
- **Discord**: discord.js v14
- **Database**: SQLite + Drizzle ORM
- **Charts**: Chart.js + @napi-rs/canvas
- **Scheduling**: node-cron

## License

MIT
