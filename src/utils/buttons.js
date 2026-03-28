const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const emojiState = require('./emojiState');

function createFactionButtons() {
  const alliesEmoji = emojiState.ALLIES
    ? { id: emojiState.ALLIES, name: 'ALLIES' }
    : { name: '🔵' };

  const axisEmoji = emojiState.AXIS
    ? { id: emojiState.AXIS, name: 'AXIS' }
    : { name: '🔴' };

  const alliesButton = new ButtonBuilder()
    .setCustomId('faction_allies')
    .setLabel('Allies')
    .setStyle(ButtonStyle.Primary)
    .setEmoji(alliesEmoji);

  const axisButton = new ButtonBuilder()
    .setCustomId('faction_axis')
    .setLabel('Axis')
    .setStyle(ButtonStyle.Danger)
    .setEmoji(axisEmoji);

  return new ActionRowBuilder().addComponents(alliesButton, axisButton);
}

module.exports = { createFactionButtons };
