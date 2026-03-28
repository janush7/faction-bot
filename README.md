# MWF Faction Bot

A Discord bot for **Midweek Frontline** — handles faction selection (Allies / Axis), lineup posting, and server details publishing.

## Features

- **Choose Your Side** — persistent embed with Allies 🔵 / Axis 🔴 buttons that assign roles
- **Lineup Posting** (`/lineup`) — upload a pre-made lineup image with auto-calculated Discord timestamps for the next Wednesday
- **Server Details** (`/server`) — post server name & password to a dedicated channel
- **In-place Editing** (`/edit`) — edit the caption of the last lineup or the server details without re-posting
- **Admin Panel** (`/panel`) — reset roles, reload faction embed, clear logs
- **Weekly Auto-Reset** — automatically removes all Allies/Axis roles every Wednesday at 22:00 Warsaw time
- **Custom Emojis** — ALLIES and AXIS emojis are auto-uploaded to the server on startup
- No database required — fully stateless

---

## Setup

### 1. Clone & install dependencies

```bash
git clone https://github.com/janush7/faction-bot.git
cd faction-bot
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
nano .env
```

| Variable | Required | Description |
|---|---|---|
| `TOKEN` | ✅ | Discord bot token |
| `CLIENT_ID` | ✅ | Bot application ID |
| `GUILD_ID` | ✅ | Your server (guild) ID |
| `CHANNEL_ID` | ✅ | Channel where the faction embed is posted |
| `ALLIES_ROLE` | ✅ | Role ID for the Allies faction |
| `AXIS_ROLE` | ✅ | Role ID for the Axis faction |
| `ADMIN_LOG_CHANNEL` | ✅ | Channel ID for admin & faction selection logs |
| `LINEUP_CHANNEL` | ✅ | Channel ID where lineups are posted |
| `SERVER_DETAILS_CHANNEL` | ✅ | Channel ID where server details are posted |
| `SERVER_NAME` | ⬜ | Default server name (default: `HCIA EU 1`) |
| `SERVER_PASSWORD` | ⬜ | Default server password (default: `MWFTIME`) |
| `RESET_DAY` | ⬜ | Day of weekly reset, 0=Sun … 6=Sat (default: `3` = Wednesday) |
| `RESET_HOUR` | ⬜ | Hour of weekly reset in Warsaw time (default: `22`) |

### 3. Deploy slash commands

```bash
npm run deploy
# or with Docker:
docker compose run --rm bot node deploy-commands.js
```

> **Run this every time you add or change a slash command.**

### 4. Start the bot

```bash
npm start
```

---

## Docker

### First run

```bash
docker compose up -d --build
docker compose run --rm bot node deploy-commands.js
```

### Update to latest

```bash
git fetch --all && git reset --hard origin/main
docker compose up -d --build
```

### Force full rebuild (if Docker cached an old layer)

```bash
docker compose down
docker compose build --no-cache
docker compose up -d
```

### View logs

```bash
docker compose logs -f bot
```

---

## Commands

| Command | Description | Permission |
|---|---|---|
| `/panel` | Open the admin control panel (Reset Roles / Reload Embed / Clear Logs) | Administrator |
| `/lineup` | Post a lineup image with Wednesday event timestamps | Administrator |
| `/server` | Post server name & password to the server details channel | Administrator |
| `/edit lineup` | Edit the caption of the last lineup embed | Administrator |
| `/edit server` | Edit the server name/password of the last server details embed | Administrator |

### `/lineup`

1. Use `/lineup image:<file>` to upload a pre-made lineup image.
2. Bot posts it to `LINEUP_CHANNEL` with Discord timestamps for the **next Wednesday**:
   - **Match Positions** — 19:30
   - **SL Briefing** — 19:30
   - **Game Start** — 20:00
3. An ephemeral ✏️ **Edit Caption** button appears — click it to rename the footer (e.g. `Midweek Frontline – Lineup – 28.03.26`).

### `/server`

Posts a **Server Details** embed to `SERVER_DETAILS_CHANNEL` with the configured server name and password. An ephemeral 🖥️ **Edit Server Details** button appears to update the values in place.

### `/edit`

Finds the **last bot message** in the relevant channel and opens a modal to edit it — no message ID needed.

- `/edit lineup` → edit the footer caption of the last lineup
- `/edit server` → edit the server name and password of the last server details embed

---

## Admin Panel

Use `/panel` (administrators only) to access:

- 🔄 **Reset Roles** — removes Allies/Axis roles from all server members immediately
- 📋 **Reload Embed** — deletes previous bot embeds from `CHANNEL_ID` and posts a fresh "Choose your side!" embed
- 🧹 **Clear Logs** — bulk-deletes all messages from `ADMIN_LOG_CHANNEL`

All admin actions are logged to `ADMIN_LOG_CHANNEL`.

---

## Weekly Auto-Reset

Every **Wednesday at 22:00 Warsaw time**, the bot automatically:
1. Removes ALLIES and AXIS roles from all server members
2. Logs the result (members affected, any errors) to `ADMIN_LOG_CHANNEL`

Configurable via `RESET_DAY` and `RESET_HOUR` in `.env`.

---

## Bot Permissions Required

- `Manage Roles` — assign/remove faction roles
- `Manage Emojis` — auto-upload ALLIES and AXIS custom emojis on startup
- `Send Messages` / `Embed Links` — post embeds
- `Read Message History` — find previous bot messages for editing and bulk-delete
- `Manage Messages` — bulk-delete messages in log channel
