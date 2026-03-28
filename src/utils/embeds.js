const { EmbedBuilder } = require('discord.js');
const { COLORS } = require('../config/constants');

function createFactionEmbed() {
  return new EmbedBuilder()
    .setTitle('Choose your side!')
    .setDescription(
      "Choose the side you'll be playing on by clicking one of the buttons below. " +
      "After selecting a side, you'll gain access to the channels where the SL briefings will take place. " +
      'Good luck, and see you on the server!'
    )
    .setColor([1, 19, 39])
    .setThumbnail('https://i.imgur.com/8ZyRVhj.png');
}

function createAdminPanelEmbed() {
  return new EmbedBuilder()
    .setTitle('⚙️ Admin Control Panel')
    .setDescription('Manage the faction system and bot settings.')
    .setColor(COLORS.INFO)
    .addFields(
      { name: '🧩 Reset Roles', value: 'Remove all faction roles from members', inline: true },
      { name: '🔄 Reload Embed', value: 'Resend the faction selection embed', inline: true },
      { name: '🗑️ Clear Logs', value: 'Delete messages from the log channel', inline: true },
    );
}

function createErrorEmbed(title, description) {
  return new EmbedBuilder()
    .setTitle(`❌ ${title}`)
    .setDescription(description)
    .setColor(COLORS.ERROR);
}

function createSuccessEmbed(title, description) {
  return new EmbedBuilder()
    .setTitle(`✅ ${title}`)
    .setDescription(description)
    .setColor(COLORS.SUCCESS);
}

module.exports = {
  createFactionEmbed,
  createAdminPanelEmbed,
  createErrorEmbed,
  createSuccessEmbed
};
