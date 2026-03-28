const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Open the admin control panel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('⚙️ Admin Panel')
      .setDescription('Use the buttons below to manage the faction bot.')
      .setColor(0x2f3136)
      .addFields(
        { name: '🔄 Reset Roles', value: 'Remove Allies/Axis roles from all members', inline: true },
        { name: '📋 Reload Embed', value: 'Post a new faction selection embed', inline: true },
        { name: '🧹 Clear Logs', value: 'Clear messages in the log channel', inline: true }
      )
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_reset')
        .setLabel('Reset Roles')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🔄'),
      new ButtonBuilder()
        .setCustomId('admin_reload')
        .setLabel('Reload Embed')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📋'),
      new ButtonBuilder()
        .setCustomId('admin_clearlogs')
        .setLabel('Clear Logs')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🧹')
    );

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  }
};
