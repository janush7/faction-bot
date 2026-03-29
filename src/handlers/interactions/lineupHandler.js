/**
 * lineupHandler.js — Handles lineup caption and server-details edit interactions.
 */

const {
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const logger = require('../../utils/logger');
const { createErrorEmbed, createSuccessEmbed } = require('../../utils/embeds');
const { THUMBNAIL_URL } = require('../../config/constants');
const { sendLog, findLastBotMessage } = require('./shared');

// ── Edit Caption Button (from /lineup ephemeral reply) ────────────────────────

async function handleLineupEditCapButton(interaction) {
  const parts     = interaction.customId.split(':');
  const channelId = parts[1];
  const messageId = parts[2];

  let currentCaption = 'Midweek Frontline – Lineup – ';
  try {
    const ch  = await interaction.client.channels.fetch(channelId);
    const msg = await ch.messages.fetch(messageId);
    currentCaption = msg.embeds[0]?.footer?.text ?? currentCaption;
  } catch (_) {}

  const modal = new ModalBuilder()
    .setCustomId(`lineup_caption:${channelId}:${messageId}`)
    .setTitle('Edit Caption');

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

  await interaction.showModal(modal);
}

async function handleLineupCaptionSubmit(interaction) {
  const parts      = interaction.customId.split(':');
  const channelId  = parts[1];
  const messageId  = parts[2];
  const newCaption = interaction.fields.getTextInputValue('caption_text');

  try {
    const ch  = await interaction.client.channels.fetch(channelId);
    const msg = await ch.messages.fetch(messageId);
    const old = msg.embeds[0];

    // Use the existing CDN image URL — re-attaching the file is not possible during an edit.
    const imageUrl = old.image?.url ?? null;

    const updated = new EmbedBuilder()
      .setColor(old.color)
      .setFooter({ text: newCaption });

    if (old.fields?.length) updated.addFields(...old.fields);
    if (imageUrl)           updated.setImage(imageUrl);
    if (old.thumbnail?.url) updated.setThumbnail(old.thumbnail.url);

    await msg.edit({ embeds: [updated] });
    logger.info(`${interaction.user.tag} updated lineup caption to: ${newCaption}`);
    await interaction.reply({ content: `✅ Caption updated to: **${newCaption}**`, flags: 64 });
  } catch (err) {
    logger.error('Failed to edit lineup caption:', err);
    await interaction.reply({ content: '❌ Could not edit the message. It may be too old or I lack permissions.', flags: 64 });
  }
}

// ── Edit Server Button (from Post Server ephemeral reply) ─────────────────────

async function handleLineupEditServerButton(interaction) {
  const parts     = interaction.customId.split(':');
  const channelId = parts[1];
  const messageId = parts[2];

  let currentName = process.env.SERVER_NAME     || 'HCIA EU 1';
  let currentPass = process.env.SERVER_PASSWORD || 'MWFTIME';

  try {
    const ch     = await interaction.client.channels.fetch(channelId);
    const msg    = await ch.messages.fetch(messageId);
    const fields = msg.embeds[0]?.fields ?? [];
    currentName  = fields.find(f => f.name.includes('Server Name'))?.value ?? currentName;
    currentPass  = fields.find(f => f.name.includes('Password'))?.value   ?? currentPass;
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

  await interaction.showModal(modal);
}

// ── Server Details Modal Submit ───────────────────────────────────────────────

async function handleServerModalSubmit(interaction) {
  const parts     = interaction.customId.split(':');
  const channelId = parts[1];
  const messageId = parts[2];
  const newName   = interaction.fields.getTextInputValue('server_name');
  const newPass   = interaction.fields.getTextInputValue('server_password');

  try {
    const ch  = await interaction.client.channels.fetch(channelId);
    const msg = await ch.messages.fetch(messageId);

    const updated = new EmbedBuilder()
      .setTitle('Server Details')
      .setColor(0x011327)
      .setThumbnail(THUMBNAIL_URL)
      .addFields(
        { name: '📌 Server Name', value: newName, inline: true },
        { name: '🔒 Password',    value: newPass, inline: true }
      );

    await msg.edit({ embeds: [updated] });
    logger.info(`${interaction.user.tag} updated server details: ${newName} / ${newPass}`);
    await interaction.reply({
      content: `✅ Server details updated!\n**Server Name:** ${newName}\n**Password:** ${newPass}`,
      flags: 64
    });
  } catch (err) {
    logger.error('Failed to edit server details:', err);
    await interaction.reply({ content: '❌ Could not edit the message. It may be too old or I lack permissions.', flags: 64 });
  }
}

// ── Admin: Post Server Details (panel button) ─────────────────────────────────

async function handleAdminPostServer(interaction) {
  await interaction.deferReply({ flags: 64 });

  const channelId = process.env.SERVER_DETAILS_CHANNEL;
  const channel   = channelId
    ? await interaction.client.channels.fetch(channelId).catch(() => null)
    : interaction.channel;

  if (!channel) {
    return interaction.editReply({
      embeds: [createErrorEmbed('Config Error', 'SERVER_DETAILS_CHANNEL not found. Check your .env.')]
    });
  }

  const serverName     = process.env.SERVER_NAME     || 'HCIA EU 1';
  const serverPassword = process.env.SERVER_PASSWORD || 'MWFTIME';

  const serverEmbed = new EmbedBuilder()
    .setTitle('Server Details')
    .setColor(0x011327)
    .setThumbnail(THUMBNAIL_URL)
    .addFields(
      { name: '📌 Server Name', value: serverName,     inline: true },
      { name: '🔒 Password',    value: serverPassword, inline: true }
    );

  const serverMsg = await channel.send({ embeds: [serverEmbed] });

  logger.info(`${interaction.user.tag} posted server details to #${channel.name}`);

  await sendLog(interaction.client, new EmbedBuilder()
    .setColor(0x011327)
    .setTitle('🖥️ Server Details Posted')
    .addFields(
      { name: '👤 Admin',   value: `<@${interaction.user.id}>`, inline: true },
      { name: '📌 Channel', value: `<#${channel.id}>`,          inline: true }
    )
    .setTimestamp()
  );

  const editBtn = new ButtonBuilder()
    .setCustomId(`lineup_editserver:${channel.id}:${serverMsg.id}`)
    .setLabel('Edit Server Details')
    .setStyle(ButtonStyle.Secondary)
    .setEmoji('✏️');

  return interaction.editReply({
    embeds: [createSuccessEmbed('Server Details Posted', `Posted to <#${channel.id}>!`)],
    components: [new ActionRowBuilder().addComponents(editBtn)]
  });
}

// ── Admin: Edit Lineup Caption (panel button) ─────────────────────────────────

async function handleAdminEditCaption(interaction) {
  const channelId = process.env.LINEUP_CHANNEL || interaction.channelId;
  const ch        = await interaction.client.channels.fetch(channelId).catch(() => null);

  if (!ch) {
    return interaction.reply({
      embeds: [createErrorEmbed('Config Error', 'LINEUP_CHANNEL not found. Check your .env.')],
      flags: 64
    });
  }

  const msg = await findLastBotMessage(ch, m => m.embeds.some(e => e.image));

  if (!msg) {
    return interaction.reply({
      content: '❌ No lineup message found in the lineup channel. Post one with `/lineup` first.',
      flags: 64
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

  await interaction.showModal(modal);
}

// ── Admin: Edit Server Details (panel button) ─────────────────────────────────

async function handleAdminEditServer(interaction) {
  const channelId = process.env.SERVER_DETAILS_CHANNEL || interaction.channelId;
  const ch        = await interaction.client.channels.fetch(channelId).catch(() => null);

  if (!ch) {
    return interaction.reply({
      embeds: [createErrorEmbed('Config Error', 'SERVER_DETAILS_CHANNEL not found. Check your .env.')],
      flags: 64
    });
  }

  const msg = await findLastBotMessage(ch, m => m.embeds.some(e => e.title === 'Server Details'));

  if (!msg) {
    return interaction.reply({
      content: '❌ No Server Details message found. Post one first using **Post Server Details**.',
      flags: 64
    });
  }

  const fields      = msg.embeds[0]?.fields ?? [];
  const currentName = fields.find(f => f.name.includes('Server Name'))?.value ?? (process.env.SERVER_NAME || 'HCIA EU 1');
  const currentPass = fields.find(f => f.name.includes('Password'))?.value   ?? (process.env.SERVER_PASSWORD || 'MWFTIME');

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

  await interaction.showModal(modal);
}

module.exports = {
  handleLineupEditCapButton,
  handleLineupCaptionSubmit,
  handleLineupEditServerButton,
  handleServerModalSubmit,
  handleAdminPostServer,
  handleAdminEditCaption,
  handleAdminEditServer
};
