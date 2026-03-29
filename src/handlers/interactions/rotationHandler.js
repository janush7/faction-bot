/**
 * rotationHandler.js — Handles Map Rotation post and edit interactions.
 *
 * Rotation is posted as a plain Discord message (not an embed) so that
 * ## markdown headings render as large section headers in Discord.
 *
 * Fixes applied:
 *  1. DST accuracy: getWarsawOffsetHours() uses Intl/toLocaleString instead of
 *     a hardcoded month-number approximation.
 *  2. Edit round-trip: raw event lines (DD/MM/YYYY - MapName) are persisted in
 *     rotationStore so the Edit modal always shows human-readable dates.
 *  3. Month headers use ## markdown — works in plain messages, not embeds.
 *  4. Message ID is stored so the bot can find the rotation message directly
 *     without scanning channel history.
 */

const {
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder
} = require('discord.js');
const logger = require('../../utils/logger');
const { createErrorEmbed, createSuccessEmbed } = require('../../utils/embeds');
const { sendLog } = require('./shared');
const {
  saveRotationRaw,
  loadRotationRaw,
  saveRotationMsgId,
  loadRotationMsgId
} = require('../../utils/rotationStore');

// ── Helpers ───────────────────────────────────────────────────────────────────

function getMapRotationChannelId() {
  return process.env.MAP_ROTATION_CHANNEL || null;
}

function getDefaultRotationData() {
  const now        = new Date();
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const m1 = now.getMonth();
  const m2 = (m1 + 1) % 12;
  const y1 = now.getFullYear();
  const y2 = m2 === 0 ? y1 + 1 : y1;
  return {
    month1Header: `${monthNames[m1]} ${y1}`,
    month1Events: '— No events scheduled —',
    month2Header: `${monthNames[m2]} ${y2}`,
    month2Events: '— No events scheduled —'
  };
}

/**
 * Returns the UTC offset for Europe/Warsaw at the given date, in hours.
 * Uses Intl to correctly handle DST transitions (last Sunday of March/October).
 */
function getWarsawOffsetHours(date) {
  const utcMs    = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' })).getTime();
  const warsawMs = new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Warsaw' })).getTime();
  return Math.round((warsawMs - utcMs) / 3_600_000);
}

/**
 * Converts lines matching "DD/MM/YYYY - MapName" to Discord timestamps.
 * Event time is assumed to be 20:00 Europe/Warsaw.
 */
function parseEventLines(text) {
  return text.split('\n').map(line => {
    const match = line.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})\s*-\s*(.+)$/);
    if (!match) return line.trim();
    const [, dd, mm, yyyy, mapName] = match;

    const probe       = new Date(`${yyyy}-${mm}-${dd}T20:00:00Z`);
    const offsetHours = getWarsawOffsetHours(probe);
    const utcHour     = 20 - offsetHours;
    const unix        = Math.floor(
      new Date(`${yyyy}-${mm}-${dd}T${String(utcHour).padStart(2, '0')}:00:00Z`).getTime() / 1000
    );

    return `<t:${unix}:F> - **${mapName.trim()}**`;
  }).join('\n');
}

/**
 * Builds the plain-text rotation message content.
 * ## headings render large in regular Discord messages.
 */
function buildRotationContent(data) {
  return [
    `## ${data.month1Header}`,
    data.month1Events || '—',
    '',
    `## ${data.month2Header}`,
    data.month2Events || '—'
  ].join('\n');
}

// ── Map Rotation Modal Submit ─────────────────────────────────────────────────

async function handleRotationModalSubmit(interaction) {
  await interaction.deferReply({ flags: 64 });

  const parts     = interaction.customId.split(':');
  const channelId = parts[1];
  const messageId = parts[2];

  const month1Header = interaction.fields.getTextInputValue('month1_header');
  const month1Raw    = interaction.fields.getTextInputValue('month1_events');
  const month2Header = interaction.fields.getTextInputValue('month2_header');
  const month2Raw    = interaction.fields.getTextInputValue('month2_events');

  const month1Events = parseEventLines(month1Raw);
  const month2Events = parseEventLines(month2Raw);

  const content = buildRotationContent({ month1Header, month1Events, month2Header, month2Events });

  try {
    const ch  = await interaction.client.channels.fetch(channelId);
    const msg = await ch.messages.fetch(messageId);

    // Edit as plain message (no embeds).
    await msg.edit({ content, embeds: [] });

    // Persist raw input for round-trip editing.
    saveRotationRaw(messageId, { month1Header, month1Events: month1Raw, month2Header, month2Events: month2Raw });

    logger.info(`${interaction.user.tag} updated Map Rotation in #${ch.name}`);

    await sendLog(interaction.client, new EmbedBuilder()
      .setColor(0x011327)
      .setTitle('\uD83D\uDDFA\uFE0F Map Rotation Edited')
      .addFields(
        { name: '\uD83D\uDC64 Admin',   value: `<@${interaction.user.id}>`, inline: true },
        { name: '\uD83D\uDCCC Channel', value: `<#${channelId}>`,           inline: true }
      )
      .setTimestamp()
    );

    return interaction.editReply({
      embeds: [createSuccessEmbed('Map Rotation Updated', 'The rotation has been updated successfully.')]
    });
  } catch (err) {
    logger.error('Failed to edit Map Rotation:', err);
    return interaction.editReply({
      embeds: [createErrorEmbed('Error', 'Could not edit the message. It may be too old or I lack permissions.')]
    });
  }
}

// ── Admin: Post Map Rotation ──────────────────────────────────────────────────

async function handleAdminPostRotation(interaction) {
  await interaction.deferReply({ flags: 64 });

  const channelId = getMapRotationChannelId();
  if (!channelId) {
    return interaction.editReply({
      embeds: [createErrorEmbed('Config Error', 'MAP_ROTATION_CHANNEL is not set in .env.')]
    });
  }

  const ch = await interaction.client.channels.fetch(channelId).catch(() => null);
  if (!ch) {
    return interaction.editReply({
      embeds: [createErrorEmbed('Channel Not Found', `Could not find channel <#${channelId}>. Check MAP_ROTATION_CHANNEL in .env.`)]
    });
  }

  const data    = getDefaultRotationData();
  const content = buildRotationContent(data);
  const msg     = await ch.send({ content });

  // Persist both the message ID and the default raw content.
  saveRotationMsgId(channelId, msg.id);
  saveRotationRaw(msg.id, data);

  logger.info(`${interaction.user.tag} posted Map Rotation to #${ch.name}`);

  await sendLog(interaction.client, new EmbedBuilder()
    .setColor(0x011327)
    .setTitle('\uD83D\uDDFA\uFE0F Map Rotation Posted')
    .addFields(
      { name: '\uD83D\uDC64 Admin',   value: `<@${interaction.user.id}>`, inline: true },
      { name: '\uD83D\uDCCC Channel', value: `<#${channelId}>`,           inline: true }
    )
    .setTimestamp()
  );

  return interaction.editReply({
    embeds: [createSuccessEmbed('Map Rotation Posted', `Posted to <#${channelId}>!\nUse **Edit Rotation** to fill in the events.`)]
  });
}

// ── Admin: Edit Map Rotation (panel button) ───────────────────────────────────

async function handleAdminEditRotation(interaction) {
  // IMPORTANT: Discord requires showModal() to be called within 3 seconds of
  // receiving the interaction. We must NOT make any async Discord API calls
  // (channel/message fetches) before calling showModal() — they can exceed
  // the timeout and cause "An error occurred." errors.
  //
  // Instead, we load everything we need from the local file store (instant, sync).

  const channelId = getMapRotationChannelId();
  if (!channelId) {
    return interaction.reply({
      embeds: [createErrorEmbed('Config Error', 'MAP_ROTATION_CHANNEL is not set in .env.')],
      flags: 64
    });
  }

  // Load stored message ID from disk — no Discord API calls needed.
  const storedMsgId = loadRotationMsgId(channelId);
  if (!storedMsgId) {
    return interaction.reply({
      content: '❌ No Map Rotation message found. Post one first using **Post Rotation**.',
      flags: 64
    });
  }

  // Load persisted raw data from disk (also instant).
  const data = loadRotationRaw(storedMsgId) ?? getDefaultRotationData();

  const modal = new ModalBuilder()
    .setCustomId(`rotation_edit:${channelId}:${storedMsgId}`)
    .setTitle('Edit Map Rotation');

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('month1_header')
        .setLabel('Month 1 (e.g. April 2026)')
        .setStyle(TextInputStyle.Short)
        .setValue(data.month1Header)
        .setMaxLength(50)
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('month1_events')
        .setLabel('Month 1 Events (DD/MM/YYYY - MapName)')
        .setStyle(TextInputStyle.Paragraph)
        .setValue(data.month1Events)
        .setMaxLength(1000)
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('month2_header')
        .setLabel('Month 2 (e.g. May 2026)')
        .setStyle(TextInputStyle.Short)
        .setValue(data.month2Header)
        .setMaxLength(50)
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('month2_events')
        .setLabel('Month 2 Events (DD/MM/YYYY - MapName)')
        .setStyle(TextInputStyle.Paragraph)
        .setValue(data.month2Events)
        .setMaxLength(1000)
        .setRequired(true)
    )
  );

  await interaction.showModal(modal);
}

module.exports = {
  handleRotationModalSubmit,
  handleAdminPostRotation,
  handleAdminEditRotation
};
