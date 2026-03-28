const { Events } = require('discord.js');
const path = require('path');
const logger = require('../utils/logger');
const emojiState = require('../utils/emojiState');

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    logger.info(`Bot is online as ${client.user.tag}`);
    logger.info(`Active in ${client.guilds.cache.size} guild(s)`);

    const guild = client.guilds.cache.get(process.env.GUILD_ID);
    if (guild) {
      await ensureEmojis(guild);
    }
  }
};

async function ensureEmojis(guild) {
  const emojiConfigs = [
    { name: 'ALLIES', file: 'ALLIES.png' },
    { name: 'AXIS', file: 'AXIS.PNG' }
  ];

  for (const { name, file } of emojiConfigs) {
    try {
      let emoji = guild.emojis.cache.find(e => e.name === name);
      if (!emoji) {
        emoji = await guild.emojis.create({
          attachment: path.join(__dirname, '../../assets', file),
          name
        });
        logger.info(`Created emoji: ${name} (${emoji.id})`);
      } else {
        logger.info(`Emoji already exists: ${name} (${emoji.id})`);
      }
      emojiState[name] = emoji.id;
    } catch (err) {
      logger.warn(`Could not load emoji ${name}: ${err.message}`);
    }
  }
}
