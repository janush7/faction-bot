# Faction Bot

A Discord bot for managing faction events — sign-ups, class queues, and role management.  
Events are persisted to a local JSON file (`data/events.json`), so **no database is required**.

---

## Quick Start

### Prerequisites

- Node.js ≥ 18
- A Discord bot application with a token

### Setup

```bash
git clone https://github.com/janush7/faction-bot.git
cd faction-bot
npm install
cp .env.example .env   # fill in your values
node deploy-commands.js
npm start
```

---

## Docker

```bash
docker-compose up -d
```

Event data is persisted to `./data/events.json` on your host via the volume mount.

---

## Environment Variables

| Variable           | Description                          |
|--------------------|--------------------------------------|
| `TOKEN`            | Discord bot token                    |
| `CLIENT_ID`        | Discord application client ID        |
| `GUILD_ID`         | Main guild ID (for command deploy)   |
| `MAIN_GUILD_ID`    | Guild ID used at runtime             |
| `CHANNEL_ID`       | Default event channel ID             |
| `ADMIN_LOG_CHANNEL`| Admin log channel ID                 |
| `ALLIES_ROLE`      | Role ID for Allies faction           |
| `AXIS_ROLE`        | Role ID for Axis faction             |

---

## Project Structure

```
src/
├── commands/
│   ├── admin/       # create-event, delete-event, panel
│   └── info/        # ping
├── config/          # constants
├── events/          # Discord event listeners
├── handlers/        # command & event loader
├── services/        # roleService, scheduleService, securityService, logService
├── store/
│   └── eventStore.js  # JSON file persistence (replaces MongoDB)
└── utils/           # embeds, buttons, logger
data/
└── events.json      # auto-created at runtime (gitignored)
```

---

## Commands

| Command          | Description                          | Permission    |
|------------------|--------------------------------------|---------------|
| `/create-event`  | Create a new faction sign-up event   | Administrator |
| `/delete-event`  | Delete an existing event             | Administrator |
| `/panel`         | Open the admin control panel         | Administrator |
| `/ping`          | Check bot latency                    | Everyone      |

---

## Event Classes & Limits

| Class      | Limit |
|------------|-------|
| Commander  | 2     |
| Artillery  | 2     |
| Infantry   | 12    |
| Recon      | 2     |
| Tank       | 6     |
| Streamer   | 1     |

When a class is full, users are added to a queue and automatically promoted when a slot opens.
