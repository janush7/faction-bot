const { ActivityType } = require('discord.js');
const logger = require('../utils/logger');

module.exports = {
  name: 'ready',
  once: true,
  execute(client) {
    logger.success(`Bot is online as ${client.user.username}`);
    logger.info(`Active in ${client.guilds.cache.size} guild(s)`);
    client.user.setActivity('Choose your side!', { type: ActivityType.Watching });
  }
};
