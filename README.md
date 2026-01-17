# Dordle

A Discord bot that tracks Wordle statistics from the official Wordle Discord app. Simply add Dordle to your server, point it at the channel where the Wordle app posts results, and it will automatically track everyone's scores.

## Add to Your Server

**[Invite Dordle](https://discord.com/oauth2/authorize?client_id=1461635317718192128&permissions=116736&integration_type=0&scope=bot+applications.commands)** - Click to add the hosted bot to your server instantly.

Once added, run `/config channel #your-wordle-channel` to start tracking.

Want to self-host instead? See [Self-Hosting](#self-hosting) below.

---

## What It Does

Dordle listens to the official Wordle Discord app's daily summary messages and automatically:

- Records each player's score
- Tracks win streaks and averages
- Maintains leaderboards
- Posts daily/weekly/monthly summaries

No manual input required from players - just keep playing Wordle as usual!

## Features

- **Automatic Score Tracking** - Listens to Wordle app messages and records scores automatically
- **ELO Rating System** - Competitive ranking system that compares players head-to-head
- **User Statistics** - Win rate, average score, current/max streaks, score distribution
- **Leaderboards** - All-time, weekly, and monthly rankings sorted by ELO
- **Charts** - Visual score distribution and trend charts
- **Auto Summaries** - Daily winners with ELO changes, weekly rankings, monthly champions
- **Backfill** - Import historical scores from past messages

## ELO Rating System

Dordle uses an ELO-based rating system adapted for Wordle's unique format. Unlike traditional head-to-head games, Wordle players compete against the same puzzle, so the system uses **pairwise comparison**.

### How It Works

1. **Starting ELO**: All players begin at 1500
2. **Pairwise Comparison**: Each player is compared head-to-head with every other player who played that day
   - If you scored better → Win (1.0 points)
   - If you tied → Draw (0.5 points)
   - If you scored worse → Loss (0.0 points)
3. **Expected Score**: Based on ELO difference between players (capped at 0.1-0.9 to prevent extreme swings)
4. **ELO Change**: `K × (actualScore - expectedScore)`

### K-Factor Tiers

The K-factor determines how much ratings can change per game:

| Games Played | K-Factor | Status |
|--------------|----------|--------|
| 0-10 | 40 | Provisional |
| 11-30 | 32 | Establishing |
| 31+ | 24 | Established |

New players' ratings move faster, while experienced players have more stable ratings.

### Fail Penalty

Failing a puzzle (X/6) carries extra consequences:
- Treated as score 9 for comparisons (always loses to any success)
- Additional -3 ELO penalty

### Missed Day Penalty

Active players who miss a day are treated as having lost to everyone who played that day. This keeps the leaderboard competitive and rewards consistent play.

- Only applies to "active" players (played within last 7 days)
- ELO floor: 1200 (can't drop below this)
- Missing when more players participated = larger penalty

### Example

**Daily Results:**
- Alice: 3/6 (1600 ELO)
- Bob: 4/6 (1550 ELO)
- Charlie: 5/6 (1480 ELO)

**Alice's Pairwise Results:**
- vs Bob: Win (scored 3, Bob scored 4)
- vs Charlie: Win (scored 3, Charlie scored 5)
- Actual score: 1.0 (2 wins / 2 opponents)

Alice's expected score vs the average opponent ELO would be ~0.62, so she gains ELO for outperforming expectations.

### Viewing ELO

- `/leaderboard` - Rankings sorted by ELO
- `/stats` - Shows your current ELO
- Daily summaries show ELO changes for each player

## Self-Hosting

If you prefer to run your own instance of Dordle:

### 1. Create Your Discord Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application** and give it a name
3. Go to **Bot** tab and click **Add Bot**
4. Enable **Message Content Intent** under Privileged Gateway Intents
5. Click **Reset Token** and copy it somewhere safe

### 2. Invite Bot to Your Server

1. Go to **OAuth2 > URL Generator**
2. Select scopes: `bot`, `applications.commands`
3. Select permissions: `Send Messages`, `Read Message History`, `Attach Files`, `Embed Links`
4. Copy the generated URL and open it to invite the bot

### 3. Run Dordle

**Option A: Using Docker (recommended)**
```bash
git clone https://github.com/bayking/dordle.git
cd dordle
cp .env.example .env
# Edit .env with your bot token and client ID
docker compose up -d
```

**Option B: Using Bun**
```bash
git clone https://github.com/bayking/dordle.git
cd dordle
bun install
cp .env.example .env
# Edit .env with your bot token and client ID
bun start
```

### 4. Configure Your Server

Once the bot is running and in your server:

1. **Set the Wordle channel** - Tell Dordle where the Wordle app posts:
   ```
   /config channel #your-wordle-channel
   ```

2. **Import past games (optional)** - Backfill historical scores:
   ```
   /backfill 30
   ```
   This scans the last 30 days of messages and imports any Wordle results.

3. **Set summary channel (optional)** - Where Dordle posts daily/weekly summaries:
   ```
   /config summary #wordle-stats
   ```

That's it! Dordle will now automatically track all Wordle games posted by the Wordle app.

## How Backfill Works

The `/backfill` command scans historical messages in your configured Wordle channel and imports past games. This is useful when:

- You just added Dordle and want to import existing history
- You want to capture games that were posted while the bot was offline

Usage:
```
/backfill [days]    # Default: 7 days, Max: 90 days
```

The bot will scan messages, find Wordle app summaries, and import all scores. Duplicate games are automatically ignored, so it's safe to run multiple times.

## Commands Reference

### For Everyone

| Command | Description |
|---------|-------------|
| `/stats` | View your own Wordle statistics |
| `/stats @user` | View another player's statistics |
| `/leaderboard` | All-time server leaderboard |
| `/leaderboard weekly` | This week's leaderboard |
| `/leaderboard monthly` | This month's leaderboard |
| `/compare @user1 @user2` | Head-to-head comparison |
| `/history` | Your recent games |
| `/history @user 20` | Someone's last 20 games |
| `/chart` | Your score distribution chart |
| `/chart @user trend` | Someone's score trend over time |

### For Admins

| Command | Description |
|---------|-------------|
| `/config channel #channel` | Set which channel has Wordle posts |
| `/config summary #channel` | Set where summaries are posted |
| `/config timezone America/New_York` | Set server timezone for summaries |
| `/backfill [days]` | Import historical Wordle messages |
| `/reset CONFIRM` | Clear all server statistics |

## Environment Variables

```
DISCORD_BOT_TOKEN=your_bot_token_here
DISCORD_APPLICATION_ID=your_client_id_here
DATABASE_PATH=./data/dordle.db
```

## Development

```bash
# Run tests
bun run test

# Run unit tests only
bun run test:unit

# Run integration tests only
bun run test:integration

# Development mode with auto-reload
bun run dev
```

## Tech Stack

- **Runtime**: [Bun](https://bun.sh)
- **Discord**: discord.js v14
- **Database**: SQLite + Drizzle ORM
- **Charts**: Chart.js + @napi-rs/canvas
- **Scheduling**: node-cron

## License

MIT
