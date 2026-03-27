require('dotenv').config();
const mongoose = require('mongoose');
const { Client, GatewayIntentBits } = require('discord.js');
const logger = require('./utils/logger');
const { REQUIRED_ENV_VARS } = require('./config/constants');

// ===== VALIDATE ENV VARIABLES =====
for (const envVar of REQUIRED_ENV_VARS) {
  if (!process.env[envVar]) {
    logger.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

logger.success('All required environment variables found');

// ===== CREATE CLIENT =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ]
});

// ===== LOAD HANDLERS =====
require('./handlers/commandHandler')(client);
require('./handlers/eventHandler')(client);

// ===== GLOBAL ERROR HANDLERS =====
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// ===== ASYNC STARTUP FUNCTION =====
async function startBot() {
  try {
    // Connect to MongoDB FIRST
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    logger.success('Connected to MongoDB');

    // THEN login to Discord
    await client.login(process.env.TOKEN);
    logger.success('Bot logged in to Discord');
  } catch (error) {
    logger.error('Failed to start bot:', error);
    process.exit(1);
  }
}

// Start the bot
startBot();
