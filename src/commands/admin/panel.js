const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createAdminPanelEmbed } = require('../../utils/embeds');
const { createAdminPanelButtons } = require('../../utils/buttons');
const { createErrorEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Open the admin control panel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        embeds: [createErrorEmbed('Permission Denied', 'You must be an administrator to use this command.')],
        ephemeral: true
      });
    }

    const embed = createAdminPanelEmbed();
    const buttons = createAdminPanelButtons();

    return interaction.reply({
      embeds: [embed],
      components: buttons,
      ephemeral: true
    });
  }
};
