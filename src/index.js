require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const logger = require('./utils/logger');
const { REQUIRED_ENV_VARS } = require('./config/constants');

const missing = REQUIRED_ENV_VARS.filter(v => !process.env[v]);
if (missing.length > 0) {
  logger.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ]
});

client.commands = new Collection();

const loadCommands = require('./handlers/commandHandler');
const loadEvents = require('./handlers/eventHandler');

loadCommands(client);
loadEvents(client);

process.on('unhandledRejection', (error) => {
  logger.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('SIGINT', () => {
  logger.info('Bot shutting down...');
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Bot shutting down...');
  client.destroy();
  process.exit(0);
});

client.login(process.env.BOT_TOKEN);
