# Faction Bot

A Discord bot for faction selection. Players click **Allies** or **Axis** to receive the matching role and gain access to their team's channels.

## Features

- **Choose Your Side** — a persistent embed with Allies / Axis buttons
- **Admin Panel** (`/panel`) — admin-only controls for resetting roles, reloading the embed, and clearing logs
- No database required — fully stateless

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Fill in `.env`:

| Variable | Description |
|---|---|
| `TOKEN` | Discord bot token |
| `CLIENT_ID` | Bot application ID |
| `GUILD_ID` | Your server ID |
| `CHANNEL_ID` | Channel where the faction embed is posted |
| `ALLIES_ROLE` | Role ID for the Allies faction |
| `AXIS_ROLE` | Role ID for the Axis faction |
| `ADMIN_LOG_CHANNEL` | *(optional)* channel ID for admin logs |

### 3. Deploy slash commands

```bash
npm run deploy
```

### 4. Start the bot

```bash
npm start
```

## Docker

```bash
docker-compose up -d
```

## Admin Panel

Use `/panel` (administrators only) to access:

- **🧩 Reset Roles** — removes Allies/Axis roles from all server members
- **🔄 Reload Embed** — posts a fresh "Choose your side!" embed in `CHANNEL_ID`
- **🗑️ Clear Logs** — bulk-deletes messages from `ADMIN_LOG_CHANNEL`

## Commands

| Command | Description | Permission |
|---|---|---|
| `/panel` | Open the admin control panel | Administrator |
| `/ping` | Check bot latency | Everyone |
