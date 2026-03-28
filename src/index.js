require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const logger = require('./utils/logger');
const { REQUIRED_ENV_VARS } = require('./config/constants');

// ── Global error handlers ─────────────────────────────────────────────────────
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

// ── Validate environment variables ────────────────────────────────────────────
const missingVars = REQUIRED_ENV_VARS.filter((v) => !process.env[v]);
if (missingVars.length > 0) {
  logger.error(`Missing required environment variables: ${missingVars.join(', ')}`);
  process.exit(1);
}

// ── Discord client ────────────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

// ── Load handlers ─────────────────────────────────────────────────────────────
const loadCommands = require('./handlers/commandHandler');
const loadEvents = require('./handlers/eventHandler');

loadCommands(client);
loadEvents(client);

// ── Connect to Discord ────────────────────────────────────────────────────────
client.login(process.env.TOKEN)
  .then(() => logger.info('Connecting to Discord...'))
  .catch((err) => {
    logger.error('Discord login failed:', err);
    process.exit(1);
  });

// ── Graceful shutdown ─────────────────────────────────────────────────────────
async function gracefulShutdown(signal) {
  logger.info(`Received ${signal} — shutting down gracefully…`);
  try {
    client.destroy();
    logger.info('Discord client destroyed');
  } catch (err) {
    logger.error('Error during shutdown:', err);
  }
  process.exit(0);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
