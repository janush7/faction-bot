const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const logger = require('../../utils/logger');

const TIMES = {
  matchPositions: { h: 19, m: 30 },
  slBriefing:     { h: 19, m: 30 },
  gameStart:      { h: 20, m: 0  },
};

function getWarsawOffsetMs(date) {
  const utc = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const warsaw = new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Warsaw' }));
  return utc - warsaw;
}

function getNextWednesdayTimestamps() {
  const now = new Date();
  const warsawNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Warsaw' }));
  const day = warsawNow.getDay();
  const hour = warsawNow.getHours();

  let daysUntilWed = (3 - day + 7) % 7;
  if (daysUntilWed === 0 && hour >= 20) daysUntilWed = 7;

  const base = new Date(warsawNow);
  base.setDate(warsawNow.getDate() + daysUntilWed);
  base.setSeconds(0);
  base.setMilliseconds(0);

  base.setHours(TIMES.matchPositions.h, TIMES.matchPositions.m);
  const matchUnix = Math.floor((base.getTime() + getWarsawOffsetMs(base)) / 1000);

  base.setHours(TIMES.slBriefing.h, TIMES.slBriefing.m);
  const slUnix = Math.floor((base.getTime() + getWarsawOffsetMs(base)) / 1000);

  base.setHours(TIMES.gameStart.h, TIMES.gameStart.m);
  const startUnix = Math.floor((base.getTime() + getWarsawOffsetMs(base)) / 1000);

  const dd = String(base.getDate()).padStart(2, '0');
  const mm = String(base.getMonth() + 1).padStart(2, '0');
  const yy = String(base.getFullYear()).slice(2);
  const dateLabel = `${dd}.${mm}.${yy}`;

  return { matchUnix, slUnix, startUnix, dateLabel };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lineup')
    .setDescription('Post the lineup to the channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addAttachmentOption(option =>
      option
        .setName('image')
        .setDescription('Lineup image')
        .setRequired(true)
    ),

  async execute(interaction) {
    // Channel restriction check
    const allowedChannelId = process.env.LINEUP_COMMAND_CHANNEL;
    if (allowedChannelId && interaction.channelId !== allowedChannelId) {
      return interaction.reply({
        content: `❌ This command can only be used in <#${allowedChannelId}>.`,
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const attachment = interaction.options.getAttachment('image');

    if (!attachment.contentType?.startsWith('image/')) {
      return interaction.editReply({ content: '❌ File must be an image (PNG, JPG, etc.)' });
    }

    const lineupChannelId = process.env.LINEUP_CHANNEL;
    const channel = lineupChannelId
      ? interaction.client.channels.cache.get(lineupChannelId)
      : interaction.channel;

    if (!channel) {
      return interaction.editReply({ content: '❌ Lineup channel not found. Check `LINEUP_CHANNEL` in `.env`.' });
    }

    const { matchUnix, slUnix, startUnix, dateLabel } = getNextWednesdayTimestamps();
    const defaultCaption = `Midweek Frontline – Lineup – ${dateLabel}`;

    const lineupEmbed = new EmbedBuilder()
      .addFields(
        { name: 'Match Positions', value: `<t:${matchUnix}:t>`, inline: true },
        { name: 'SL Briefing',     value: `<t:${slUnix}:t>`,    inline: true },
        { name: 'Game Start',      value: `<t:${startUnix}:t>`, inline: true },
      )
      .setImage('attachment://lineup.png')
      .setFooter({ text: defaultCaption })
      .setColor(0x011325);

    const posted = await channel.send({
      embeds: [lineupEmbed],
      files: [{ attachment: attachment.url, name: 'lineup.png' }],
    });

    const logChannel = process.env.ADMIN_LOG_CHANNEL
      ? interaction.client.channels.cache.get(process.env.ADMIN_LOG_CHANNEL)
      : null;
    if (logChannel) {
      const logEmbed = new EmbedBuilder()
        .setTitle('📋 Lineup Posted')
        .setDescription(`Lineup posted to ${channel}`)
        .addFields({ name: 'Admin', value: `${interaction.user}`, inline: true })
        .setColor(0x5865f2)
        .setTimestamp();
      logChannel.send({ embeds: [logEmbed] }).catch(() => {});
    }

    logger.info(`Lineup sent to #${channel.name} by ${interaction.user.tag}`);

    const editCaptionBtn = new ButtonBuilder()
      .setCustomId(`lineup_editcap:${channel.id}:${posted.id}`)
      .setLabel('✏️ Edit Caption')
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(editCaptionBtn);

    await interaction.editReply({
      content: `✅ Lineup posted to ${channel}!`,
      components: [row],
    });
  },
};
