# Faction Bot 🎖️

A Discord bot for managing faction events — sign-ups, team balancing, scheduling, and admin controls.

## Features

- Create & manage Allies / Axis faction events
- Role-based sign-up with queue system
- Automated event reminders via scheduler
- Secure admin panel (create, delete, reset events)
- MongoDB persistence
- Structured logging

---

## Quick Start

### Prerequisites

| Tool | Version |
|------|---------|
| Node.js | ≥ 18 |
| MongoDB | ≥ 6 |
| Discord App | Bot token required |

### 1. Clone the repo

```bash
git clone https://github.com/janush7/faction-bot.git
cd faction-bot
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Fill in your values — see [Environment Variables](#environment-variables) below.

### 4. Register slash commands

```bash
node deploy-commands.js
```

### 5. Start the bot

```bash
node src/index.js
```

---

## Docker

```bash
# Copy and fill in your .env
cp .env.example .env

# Build & start
docker compose up -d
```

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DISCORD_TOKEN` | Bot token from Discord Developer Portal |
| `CLIENT_ID` | Your bot's application ID |
| `GUILD_ID` | The Discord server ID |
| `MONGO_URI` | MongoDB connection string |
| `LOG_CHANNEL_ID` | Channel ID for bot logs |
| `ADMIN_ROLE_ID` | Role ID for admin commands |
| `ALLIES_ROLE_ID` | Role ID for Allies faction |
| `AXIS_ROLE_ID` | Role ID for Axis faction |
| `FACTION_COOLDOWN` | Cooldown in seconds between faction switches |

---

## Project Structure

```
faction-bot/
├── src/
│   ├── commands/
│   │   ├── admin/          # Admin commands (create-event, delete-event, panel)
│   │   └── info/           # Info commands (ping)
│   ├── events/             # Discord event handlers (ready, interactionCreate)
│   ├── handlers/           # Command & event auto-loaders
│   ├── models/             # Mongoose schemas
│   ├── services/           # Business logic (roles, scheduling, security, logs)
│   ├── utils/              # Embeds, buttons, logger, error helpers
│   ├── config/             # Constants
│   └── index.js            # Entry point
├── deploy-commands.js      # Slash command registration script
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Commit your changes
4. Open a pull request

---

## License

MIT
