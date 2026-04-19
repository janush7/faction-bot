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
        { name: '📋 Faction & Lineup',  value: 'Reload embed, reset roles, or edit lineup caption (S1/S2)', inline: false },
        { name: '🖥️ Server Details',    value: 'Post or edit server details',                       inline: false },
        { name: '📍 Nodes',             value: 'Post or edit the Nodes info embed',                 inline: false },
        { name: '🗺️ Map Rotation',      value: 'Post or edit the Map Rotation embed',               inline: false },
        { name: '🧹 Logs',              value: 'Clear messages in the log channel',                 inline: false }
      );

    // Row 1 — Faction & Lineup
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
        .setEmoji('🔁'),
      new ButtonBuilder()
        .setCustomId('admin_edit_caption:S1')
        .setLabel('Edit Caption - S1')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('✏️'),
      new ButtonBuilder()
        .setCustomId('admin_edit_caption:S2')
        .setLabel('Edit Caption - S2')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('✏️')
    );

    // Row 2 — Server Details
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_post_server:S1')
        .setLabel('Post Server Details - S1')
        .setStyle(ButtonStyle.Success)
        .setEmoji('📤'),
      new ButtonBuilder()
        .setCustomId('admin_post_server:S2')
        .setLabel('Post Server Details - S2')
        .setStyle(ButtonStyle.Success)
        .setEmoji('📤'),
      new ButtonBuilder()
        .setCustomId('admin_edit_server:S1')
        .setLabel('Edit Server Details - S1')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('✏️'),
      new ButtonBuilder()
        .setCustomId('admin_edit_server:S2')
        .setLabel('Edit Server Details - S2')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('✏️')
    );

    // Row 3 — Nodes
    const row3 = new ActionRowBuilder().addComponents(
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

    // Row 4 — Map Rotation
    const row4 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_post_rotation')
        .setLabel('Post Rotation')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🗺️'),
      new ButtonBuilder()
        .setCustomId('admin_edit_rotation')
        .setLabel('Edit Rotation')
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
