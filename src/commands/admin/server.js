const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const logger = require('../../utils/logger');

const THUMBNAIL_URL = 'https://raw.githubusercontent.com/janush7/faction-bot/main/assets/MWF.png';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('server')
    .setDescription('Post server details to the server details channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const channelId = process.env.SERVER_DETAILS_CHANNEL;
    const channel = channelId
      ? interaction.client.channels.cache.get(channelId)
      : interaction.channel;

    if (!channel) {
      return interaction.editReply({
        content: '❌ Server details channel not found. Check `SERVER_DETAILS_CHANNEL` in `.env`.',
      });
    }

    const serverName     = process.env.SERVER_NAME     || 'HCIA EU 1';
    const serverPassword = process.env.SERVER_PASSWORD || 'MWFTIME';

    const serverEmbed = new EmbedBuilder()
      .setTitle('Server Details')
      .setColor(0x011325)
      .setThumbnail(THUMBNAIL_URL)
      .addFields(
        { name: '📌 Server Name', value: serverName,     inline: true },
        { name: '🔒 Password',    value: serverPassword, inline: true }
      );

    const serverMsg = await channel.send({ embeds: [serverEmbed] });

    // ── Log ───────────────────────────────────────────────────────────────────
    const logChannel = process.env.ADMIN_LOG_CHANNEL
      ? interaction.client.channels.cache.get(process.env.ADMIN_LOG_CHANNEL)
      : null;
    if (logChannel) {
      const logEmbed = new EmbedBuilder()
        .setTitle('🖥️ Server Details Posted')
        .setDescription(`Server details posted to ${channel}`)
        .addFields({ name: 'Admin', value: `${interaction.user}`, inline: true })
        .setColor(0x5865f2)
        .setTimestamp();
      logChannel.send({ embeds: [logEmbed] }).catch(() => {});
    }

    logger.info(`Server details sent to #${channel.name} by ${interaction.user.tag}`);

    // ── Edit button ───────────────────────────────────────────────────────────
    const editBtn = new ButtonBuilder()
      .setCustomId(`lineup_editserver:${channel.id}:${serverMsg.id}`)
      .setLabel('🖥️ Edit Server Details')
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(editBtn);

    await interaction.editReply({
      content: `✅ Server details posted to ${channel}!\n\nTo edit an older server details message: \`/edit server message_id:<id>\``,
      components: [row],
    });
  },
};
