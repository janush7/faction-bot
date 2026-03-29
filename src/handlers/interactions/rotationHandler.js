/**
 * rotationHandler.js — Handles Map Rotation post and edit interactions.
 *
 * Rotation is posted as a Discord embed.
 * Raw event lines are persisted in /tmp/ for round-trip editing.
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
const { THUMBNAIL_URL } = require('../../config/constants');
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
 * Uses Intl to correctly handle DST transitions.
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
 * Builds the Map Rotation embed.
 */
function buildRotationEmbed(data) {
  return new EmbedBuilder()
    .setColor(0x011327)
    .setTitle('Map Rotation')
    .setThumbnail(THUMBNAIL_URL)
    .addFields(
      { name: data.month1Header, value: data.month1Events || '— No events scheduled —' },
      { name: data.month2Header, value: data.month2Events || '— No events scheduled —' }
    );
}

/**
 * Scans the last 50 messages in a channel to find an existing rotation embed
 * (used as fallback when the message ID is not stored in /tmp/).
 */
async function findRotationMessage(channel) {
  try {
    const messages = await channel.messages.fetch({ limit: 50 });
    return messages.find(m =>
      m.author.bot &&
      m.embeds.length > 0 &&
      m.embeds[0].title === 'Map Rotation'
    ) ?? null;
  } catch (_) {
    return null;
  }
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

  const embed = buildRotationEmbed({ month1Header, month1Events, month2Header, month2Events });

  try {
    const ch  = await interaction.client.channels.fetch(channelId);
    const msg = await ch.messages.fetch(messageId);

    await msg.edit({ embeds: [embed], content: null });

    // Persist raw input for round-trip editing.
    saveRotationRaw(messageId, { month1Header, month1Events: month1Raw, month2Header, month2Events: month2Raw });

    logger.info(`${interaction.user.tag} updated Map Rotation in #${ch.name}`);

    await sendLog(interaction.client, new EmbedBuilder()
      .setColor(0x011327)
      .setTitle('Map Rotation Edited')
      .addFields(
        { name: 'Admin',   value: `<@${interaction.user.id}>`, inline: true },
        { name: 'Channel', value: `<#${channelId}>`,           inline: true }
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

  const data  = getDefaultRotationData();
  const embed = buildRotationEmbed(data);
  const msg   = await ch.send({ embeds: [embed] });

  saveRotationMsgId(channelId, msg.id);
  saveRotationRaw(msg.id, data);

  logger.info(`${interaction.user.tag} posted Map Rotation to #${ch.name}`);

  await sendLog(interaction.client, new EmbedBuilder()
    .setColor(0x011327)
    .setTitle('Map Rotation Posted')
    .addFields(
      { name: 'Admin',   value: `<@${interaction.user.id}>`, inline: true },
      { name: 'Channel', value: `<#${channelId}>`,           inline: true }
    )
    .setTimestamp()
  );

  return interaction.editReply({
    embeds: [createSuccessEmbed('Map Rotation Posted', `Posted to <#${channelId}>!\nUse **Edit Rotation** to fill in the events.`)]
  });
}

// ── Admin: Edit Map Rotation (panel button) ───────────────────────────────────

async function handleAdminEditRotation(interaction) {
  // IMPORTANT: Discord requires showModal() within 3 seconds.
  // Load everything from /tmp/ (instant) — no async Discord API calls before modal.

  const channelId = getMapRotationChannelId();
  if (!channelId) {
    return interaction.reply({
      embeds: [createErrorEmbed('Config Error', 'MAP_ROTATION_CHANNEL is not set in .env.')],
      flags: 64
    });
  }

  // Load stored message ID from /tmp/ — no Discord API calls needed.
  let storedMsgId = loadRotationMsgId(channelId);

  if (!storedMsgId) {
    // Fallback: scan channel for existing rotation embed (happens after bot restart).
    // This is async, but only runs once when /tmp/ is empty (e.g. after restart).
    await interaction.deferReply({ flags: 64 });
    const ch = await interaction.client.channels.fetch(channelId).catch(() => null);
    if (ch) {
      const found = await findRotationMessage(ch);
      if (found) {
        storedMsgId = found.id;
        saveRotationMsgId(channelId, found.id);
      }
    }
    if (!storedMsgId) {
      return interaction.editReply({
        content: '❌ No Map Rotation message found. Post one first using **Post Rotation**.',
      });
    }
    // Re-open modal after deferred reply isn't possible — inform user instead.
    return interaction.editReply({
      embeds: [createSuccessEmbed('Ready', 'Message found! Please click **Edit Rotation** again to open the editor.')]
    });
  }

  // Load persisted raw data from /tmp/ (also instant).
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
