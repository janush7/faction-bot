const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const logger = require('../../utils/logger');

/**
 * Returns Unix timestamps for next Wednesday's event times (Warsaw timezone).
 * If today is Wednesday and it's before 20:00 Warsaw time, uses today.
 */
function getNextWednesdayTimestamps() {
  const now = new Date();

  // Get current time in Warsaw
  const warsawNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Warsaw' }));
  const day = warsawNow.getDay(); // 0=Sun, 3=Wed
  const hour = warsawNow.getHours();

  // Days until next Wednesday
  let daysUntilWed = (3 - day + 7) % 7;
  // If today is Wednesday and event hasn't started yet (before 20:00), use today
  if (daysUntilWed === 0 && hour >= 20) daysUntilWed = 7;

  // Build Warsaw date for next Wednesday
  const eventDate = new Date(warsawNow);
  eventDate.setDate(warsawNow.getDate() + daysUntilWed);
  eventDate.setSeconds(0);
  eventDate.setMilliseconds(0);

  // Match Positions & SL Briefing: 19:30
  eventDate.setHours(19, 30);
  const ts1930 = Math.floor(new Date(eventDate.toLocaleString('en-US', { timeZone: 'Europe/Warsaw' }) + ' UTC').getTime() / 1000);

  // Proper UTC conversion for Warsaw 19:30
  const matchDate = new Date(eventDate);
  // Use Intl to get offset
  const offsetMatch = getWarsawOffsetMs(matchDate);
  const matchUnix = Math.floor((matchDate.getTime() - offsetMatch) / 1000);

  // Game Start: 20:00
  eventDate.setHours(20, 0);
  const startDate = new Date(eventDate);
  const offsetStart = getWarsawOffsetMs(startDate);
  const startUnix = Math.floor((startDate.getTime() - offsetStart) / 1000);

  return { matchUnix, startUnix };
}

function getWarsawOffsetMs(date) {
  // Get Warsaw UTC offset in ms
  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const warsawDate = new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Warsaw' }));
  return utcDate - warsawDate;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lineup')
    .setDescription('Wyślij lineup na kanał')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addAttachmentOption(option =>
      option
        .setName('zdjecie')
        .setDescription('Zdjęcie ze składem')
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const attachment = interaction.options.getAttachment('zdjecie');

    // Validate it's an image
    if (!attachment.contentType?.startsWith('image/')) {
      return interaction.editReply({ content: '❌ Plik musi być obrazkiem (PNG, JPG itp.)' });
    }

    const lineupChannelId = process.env.LINEUP_CHANNEL;
    const channel = lineupChannelId
      ? interaction.client.channels.cache.get(lineupChannelId)
      : interaction.channel;

    if (!channel) {
      return interaction.editReply({ content: '❌ Nie znaleziono kanału lineupów. Sprawdź `LINEUP_CHANNEL` w `.env`.' });
    }

    const { matchUnix, startUnix } = getNextWednesdayTimestamps();

    const content = [
      '## MWF – LINEUPS',
      `**Match Positions:** <t:${matchUnix}:t>`,
      `**SL Briefing:** <t:${matchUnix}:t>`,
      `**Game Start:** <t:${startUnix}:t>`,
    ].join('\n');

    await channel.send({
      content,
      files: [{ attachment: attachment.url, name: attachment.name }],
    });

    // Log to admin channel
    const logChannelId = process.env.ADMIN_LOG_CHANNEL;
    const logChannel = logChannelId ? interaction.client.channels.cache.get(logChannelId) : null;
    if (logChannel) {
      const embed = new EmbedBuilder()
        .setTitle('📋 Lineup wysłany')
        .setDescription(`Lineup został wysłany na ${channel}`)
        .addFields({ name: 'Admin', value: `${interaction.user}`, inline: true })
        .setColor(0x5865f2)
        .setTimestamp();
      logChannel.send({ embeds: [embed] }).catch(() => {});
    }

    logger.info(`Lineup sent to #${channel.name} by ${interaction.user.tag}`);
    await interaction.editReply({ content: `✅ Lineup wysłany na ${channel}!` });
  },
};
