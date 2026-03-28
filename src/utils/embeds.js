const { EmbedBuilder } = require('discord.js');

function createFactionEmbed() {
  return new EmbedBuilder()
    .setTitle('⚔️ Choose Your Side!')
    .setDescription('Join the **Allies** or the **Axis** — pick your faction and enter the battlefield!')
    .setColor(0x2f3136)
    .addFields(
      { name: '🔵 Allies', value: 'Fight for freedom and democracy', inline: true },
      { name: '🔴 Axis', value: 'Fight for power and glory', inline: true }
    )
    .setFooter({ text: 'You can only be in one faction at a time' })
    .setTimestamp();
}

function createSuccessEmbed(title, description) {
  return new EmbedBuilder()
    .setTitle(`✅ ${title}`)
    .setDescription(description)
    .setColor(0x2ecc71)
    .setTimestamp();
}

function createErrorEmbed(title, description) {
  return new EmbedBuilder()
    .setTitle(`❌ ${title}`)
    .setDescription(description)
    .setColor(0xe74c3c)
    .setTimestamp();
}

module.exports = { createFactionEmbed, createSuccessEmbed, createErrorEmbed };
