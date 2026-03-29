/**
 * rotationHandler.js — Handles Map Rotation embed post and edit interactions.
 *
 * Fixes applied:
 *  1. DST accuracy: getWarsawOffsetHours() uses Intl/toLocaleString instead of
 *     a hardcoded month-number approximation that mis-fires near DST transitions.
 *  2. Edit round-trip: raw event lines (DD/MM/YYYY - MapName) are persisted in
 *     rotationStore so the Edit Rotation modal always shows the human-readable
 *     date instead of the rendered <t:unix:F> Discord timestamps.
 *  3. Month headers use ## markdown heading so they render larger in Discord.
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
const { THUMBNAIL_URL } = require('../../config/constants');
const { sendLog, findLastBotMessage } = require('./shared');
const { saveRotationRaw, loadRotationRaw } = require('../../utils/rotationStore');

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
 * Uses the browser-independent Intl approach to handle DST transitions
 * correctly (last Sunday of March / last Sunday of October).
 *
 * @param {Date} date
 * @returns {number}  e.g. 1 (CET) or 2 (CEST)
 */
function getWarsawOffsetHours(date) {
  const utcMs    = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' })).getTime();
  const warsawMs = new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Warsaw' })).getTime();
  return Math.round((warsawMs - utcMs) / 3_600_000);
}

/**
 * Converts lines matching "DD/MM/YYYY - MapName" to Discord timestamps.
 * Lines that don't match the pattern are left unchanged.
 * Event time is assumed to be 20:00 Europe/Warsaw.
 *
 * @param {string} text
 * @returns {string}
 */
function parseEventLines(text) {
  return text.split('\n').map(line => {
    const match = line.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})\s*-\s*(.+)$/);
    if (!match) return line.trim();
    const [, dd, mm, yyyy, mapName] = match;

    // Build a Date at 20:00 UTC on that day, then adjust for Warsaw offset.
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
 * Month headers use ## markdown so they render as large headings in Discord.
 */
function buildRotationEmbed(data) {
  const description = [
    `## ${data.month1Header}`,
    data.month1Events || '—',
    '',
    `## ${data.month2Header}`,
    data.month2Events || '—'
  ].join('\n');

  return new EmbedBuilder()
    .setAuthor({ name: 'MWF Map Rotation', iconURL: THUMBNAIL_URL })
    .setColor(0x011327)
    .setDescription(description);
}

// ── Map Rotation Modal Submit ─────────────────────────────────────────────────

async function handleRotationModalSubmit(interaction) {
  await interaction.deferReply({ flags: 64 });

  const parts  = interaction.customId.split(':');
  const channelId = parts[1];
  const messageId = parts[2];

  const month1Header = interaction.fields.getTextInputValue('month1_header');
  const month1Raw    = interaction.fields.getTextInputValue('month1_events');
  const month2Header = interaction.fields.getTextInputValue('month2_header');
  const month2Raw    = interaction.fields.getTextInputValue('month2_events');

  const month1Events = parseEventLines(month1Raw);
  const month2Events = parseEventLines(month2Raw);

  const updatedEmbed = buildRotationEmbed({ month1Header, month1Events, month2Header, month2Events });

  try {
    const ch  = await interaction.client.channels.fetch(channelId);
    const msg = await ch.messages.fetch(messageId);
    await msg.edit({ embeds: [updatedEmbed] });

    // Persist raw input so the Edit modal can round-trip correctly.
    saveRotationRaw(messageId, { month1Header, month1Events: month1Raw, month2Header, month2Events: month2Raw });

    logger.info(`${interaction.user.tag} updated Map Rotation embed in #${ch.name}`);

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
      embeds: [createSuccessEmbed('Map Rotation Updated', 'The embed has been updated successfully.')]
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

  // Seed the store with the default raw content for immediate round-trip support.
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
  const channelId = getMapRotationChannelId();
  if (!channelId) {
    return interaction.reply({
      embeds: [createErrorEmbed('Config Error', 'MAP_ROTATION_CHANNEL is not set in .env.')],
      flags: 64
    });
  }

  const ch = await interaction.client.channels.fetch(channelId).catch(() => null);
  if (!ch) {
    return interaction.reply({
      embeds: [createErrorEmbed('Channel Not Found', `Could not find channel <#${channelId}>. Check MAP_ROTATION_CHANNEL in .env.`)],
      flags: 64
    });
  }

  const msg = await findLastBotMessage(ch, m => m.embeds.some(e => e.author?.name === 'MWF Map Rotation'));

  if (!msg) {
    return interaction.reply({
      content: '\u274C No Map Rotation message found in the channel. Post one first using **Post Rotation**.',
      flags: 64
    });
  }

  // Prefer the persisted raw data (round-trip safe).
  // Fall back to parsing the embed description (legacy / old-format embeds).
  let data = loadRotationRaw(msg.id);

  if (!data) {
    const description = msg.embeds[0]?.description ?? '';
    // Parse sections split by ## headings
    const sections = description.split(/^## /m).filter(Boolean);
    if (sections.length >= 2) {
      const parseSection = (section) => {
        const lines = section.split('\n');
        const header = lines[0].trim();
        const events = lines.slice(1).join('\n').trim();
        return { header, events };
      };
      const s1 = parseSection(sections[0]);
      const s2 = parseSection(sections[1]);
      data = {
        month1Header: s1.header,
        month1Events: s1.events,
        month2Header: s2.header,
        month2Events: s2.events
      };
    } else {
      // Last resort: try old field-based format
      const fields   = msg.embeds[0]?.fields ?? [];
      const stripPad = (str) => str.replace(/^\u200B\n/, '');
      data = fields.length >= 2
        ? {
            month1Header: fields[0].name,
            month1Events: stripPad(fields[0].value),
            month2Header: fields[1].name,
            month2Events: stripPad(fields[1].value)
          }
        : getDefaultRotationData();
    }
  }

  const modal = new ModalBuilder()
    .setCustomId(`rotation_edit:${ch.id}:${msg.id}`)
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
