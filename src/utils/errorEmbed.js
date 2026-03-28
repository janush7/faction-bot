const { EmbedBuilder } = require('discord.js');

/**
 * Creates a standardised error embed.
 * @param {string} title  - Short error title
 * @param {string} description - Human-readable error message
 * @returns {EmbedBuilder}
 */
function createErrorEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle(`❌ ${title}`)
    .setDescription(description)
    .setTimestamp();
}

module.exports = { createErrorEmbed };
