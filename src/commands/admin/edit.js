const { SlashCommandBuilder, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('edit')
    .setDescription('Edit a previously posted bot message')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub
        .setName('lineup')
        .setDescription('Edit the caption of a posted lineup embed')
        .addStringOption(opt =>
          opt
            .setName('message_id')
            .setDescription('ID of the lineup message to edit')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('server')
        .setDescription('Edit the server name/password of a posted server details embed')
        .addStringOption(opt =>
          opt
            .setName('message_id')
            .setDescription('ID of the server details message to edit')
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    const sub       = interaction.options.getSubcommand();
    const messageId = interaction.options.getString('message_id');

    // ── Edit Lineup Caption ────────────────────────────────────────────────────
    if (sub === 'lineup') {
      const channelId = process.env.LINEUP_CHANNEL || interaction.channelId;

      let currentCaption = 'Midweek Frontline – Lineup – ';
      try {
        const ch  = await interaction.client.channels.fetch(channelId);
        const msg = await ch.messages.fetch(messageId);
        currentCaption = msg.embeds[0]?.footer?.text ?? currentCaption;
      } catch (_) {}

      const modal = new ModalBuilder()
        .setCustomId(`lineup_caption:${channelId}:${messageId}`)
        .setTitle('Edit Lineup Caption');

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('caption_text')
            .setLabel('Caption')
            .setStyle(TextInputStyle.Short)
            .setValue(currentCaption)
            .setMaxLength(100)
            .setRequired(true)
        )
      );

      return interaction.showModal(modal);
    }

    // ── Edit Server Details ────────────────────────────────────────────────────
    if (sub === 'server') {
      const channelId = process.env.SERVER_DETAILS_CHANNEL || interaction.channelId;

      let currentName = process.env.SERVER_NAME     || 'HCIA EU 1';
      let currentPass = process.env.SERVER_PASSWORD || 'MWFTIME';

      try {
        const ch     = await interaction.client.channels.fetch(channelId);
        const msg    = await ch.messages.fetch(messageId);
        const fields = msg.embeds[0]?.fields ?? [];
        const nameF  = fields.find(f => f.name.includes('Server Name'));
        const passF  = fields.find(f => f.name.includes('Password'));
        if (nameF) currentName = nameF.value;
        if (passF) currentPass = passF.value;
      } catch (_) {}

      const modal = new ModalBuilder()
        .setCustomId(`lineup_server:${channelId}:${messageId}`)
        .setTitle('Edit Server Details');

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('server_name')
            .setLabel('Server Name')
            .setStyle(TextInputStyle.Short)
            .setValue(currentName)
            .setMaxLength(100)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('server_password')
            .setLabel('Password')
            .setStyle(TextInputStyle.Short)
            .setValue(currentPass)
            .setMaxLength(100)
            .setRequired(true)
        )
      );

      return interaction.showModal(modal);
    }
  },
};
