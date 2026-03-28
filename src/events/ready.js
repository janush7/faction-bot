const { ActivityType } = require('discord.js');
const logger = require('../utils/logger');

module.exports = {
  name: 'ready',
  once: true,
  execute(client) {
    logger.success(`✅ Bot is online as ${client.user.username}#${client.user.discriminator}`);
    logger.info(`Bot is in ${client.guilds.cache.size} guild(s)`);
    
    // Set bot status
    client.user.setActivity('Event Management', { type: ActivityType.Listening });
  }
};
