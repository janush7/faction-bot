const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Open the admin control panel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('⚙️ Admin Panel')
      .setColor(0x011327)
      .addFields(
        { name: '📋 Faction',        value: 'Reload the faction embed or reset all roles', inline: false },
        { name: '📸 Lineup',         value: 'Edit the caption of the last posted lineup',  inline: false },
        { name: '🖥️ Server Details', value: 'Post or edit server details',                 inline: false },
        { name: '📍 Nodes',          value: 'Post or edit the Nodes info embed',            inline: false },
        { name: '🧹 Logs',           value: 'Clear messages in the log channel',            inline: false }
      );

    // Row 1 — Faction
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_reload')
        .setLabel('Reload Embed')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📋'),
      new ButtonBuilder()
        .setCustomId('admin_reset')
        .setLabel('Reset Roles')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🔁')
    );

    // Row 2 — Lineup
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_edit_caption')
        .setLabel('Edit Caption')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('✏️')
    );

    // Row 3 — Server Details
    const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_post_server')
        .setLabel('Post Server Details')
        .setStyle(ButtonStyle.Success)
        .setEmoji('📤'),
      new ButtonBuilder()
        .setCustomId('admin_edit_server')
        .setLabel('Edit Server Details')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('✏️')
    );

    // Row 4 — Nodes
    const row4 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_post_nodes')
        .setLabel('Post Nodes')
        .setStyle(ButtonStyle.Success)
        .setEmoji('📍'),
      new ButtonBuilder()
        .setCustomId('admin_edit_nodes')
        .setLabel('Edit Nodes')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('✏️')
    );

    // Row 5 — Logs
    const row5 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_clearlogs')
        .setLabel('Clear Logs')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🧹')
    );

    await interaction.reply({
      embeds: [embed],
      components: [row1, row2, row3, row4, row5],
      flags: 64
    });
  }
};
