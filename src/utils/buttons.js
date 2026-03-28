const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

function createFactionButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('allies')
      .setLabel('Allies')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🔵'),
    new ButtonBuilder()
      .setCustomId('axis')
      .setLabel('Axis')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🔴')
  );
}

module.exports = { createFactionButtons };
