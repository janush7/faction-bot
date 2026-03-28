const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require('discord.js');

/**
 * Fetch the last message sent by the bot in `channel` that matches `predicate`.
 * Scans up to `limit` messages.
 */
async function findLastBotMessage(channel, predicate, limit = 50) {
  const messages = await channel.messages.fetch({ limit });
  return messages.find(m => m.author.id === channel.client.user.id && predicate(m)) ?? null;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('edit')
    .setDescription('Edit the last bot message in the relevant channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub
        .setName('lineup')
        .setDescription('Edit the caption of the last lineup embed')
    )
    .addSubcommand(sub =>
      sub
        .setName('server')
        .setDescription('Edit the server name/password of the last server details embed')
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    // ── Edit Lineup Caption ────────────────────────────────────────────────────
    if (sub === 'lineup') {
      const channelId = process.env.LINEUP_CHANNEL || interaction.channelId;
      const ch = await interaction.client.channels.fetch(channelId).catch(() => null);

      if (!ch) {
        return interaction.reply({
          content: '❌ Lineup channel not found. Check `LINEUP_CHANNEL` in `.env`.',
          ephemeral: true,
        });
      }

      // Find last bot message that has an image embed (lineup)
      const msg = await findLastBotMessage(ch, m => m.embeds.some(e => e.image));

      if (!msg) {
        return interaction.reply({
          content: '❌ No lineup message found in the lineup channel.',
          ephemeral: true,
        });
      }

      const currentCaption = msg.embeds[0]?.footer?.text ?? 'Midweek Frontline – Lineup – ';

      const modal = new ModalBuilder()
        .setCustomId(`lineup_caption:${ch.id}:${msg.id}`)
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
      const ch = await interaction.client.channels.fetch(channelId).catch(() => null);

      if (!ch) {
        return interaction.reply({
          content: '❌ Server details channel not found. Check `SERVER_DETAILS_CHANNEL` in `.env`.',
          ephemeral: true,
        });
      }

      // Find last bot message that has a "Server Details" embed
      const msg = await findLastBotMessage(
        ch,
        m => m.embeds.some(e => e.title === 'Server Details')
      );

      if (!msg) {
        return interaction.reply({
          content: '❌ No Server Details message found in the server details channel.',
          ephemeral: true,
        });
      }

      const fields       = msg.embeds[0]?.fields ?? [];
      const currentName  = fields.find(f => f.name.includes('Server Name'))?.value ?? (process.env.SERVER_NAME || 'HCIA EU 1');
      const currentPass  = fields.find(f => f.name.includes('Password'))?.value   ?? (process.env.SERVER_PASSWORD || 'MWFTIME');

      const modal = new ModalBuilder()
        .setCustomId(`lineup_server:${ch.id}:${msg.id}`)
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
