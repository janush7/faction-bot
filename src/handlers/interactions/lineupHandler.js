/**
 * lineupHandler.js — Handles lineup caption and server-details edit interactions.
 *
 * Admin panel buttons (Edit Caption / Edit Server) use a local cache
 * to avoid async API calls before showModal() — prevents the 3-second
 * Discord interaction timeout.
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
const { saveLineupData, loadLineupData, saveServerData, loadServerData } = require('../../utils/lineupStore');

// ── Edit Caption Button (from /lineup ephemeral reply) ────────────────────────

async function handleLineupEditCapButton(interaction) {
  const parts     = interaction.customId.split(':');
  const channelId = parts[1];
  const buttonMessageId = parts[2];
  const server    = parts[3] || null; // S1 | S2 | null (legacy)

  const cached = loadLineupData(channelId, server);
  const messageId = cached?.messageId ?? buttonMessageId;
  let currentCaption = cached?.caption ?? 'Midweek Frontline \u2013 Lineup \u2013 ';

  if (!cached || cached.messageId !== messageId) {
    try {
      const ch  = await interaction.client.channels.fetch(channelId);
      const msg = await ch.messages.fetch(messageId);
      currentCaption = msg.embeds[0]?.footer?.text ?? currentCaption;
      saveLineupData(channelId, messageId, currentCaption, server);
    } catch (_) {}
  }

  const serverSuffix = server ? `:${server}` : '';
  const modal = new ModalBuilder()
    .setCustomId(`lineup_caption:${channelId}:${messageId}${serverSuffix}`)
    .setTitle(server ? `Edit Caption (${server})` : 'Edit Caption');

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
  const modalMessageId = parts[2];
  const server     = parts[3] || null; // S1 | S2 | null (legacy)
  const newCaption = interaction.fields.getTextInputValue('caption_text');

  try {
    const ch = await interaction.client.channels.fetch(channelId);

    const cached = loadLineupData(channelId, server);
    const messageId = cached?.messageId ?? modalMessageId;
    const oldMsg = await ch.messages.fetch(messageId);
    const old    = oldMsg.embeds[0];

    // Discord resolves `attachment://lineup.png` to a CDN URL when the
    // embed is fetched via API, and reports attachments=0 (the file is
    // "claimed" internally). Editing the embed with the CDN URL causes
    // Discord to decouple the image from the embed.
    //
    // Fix: download the image from the CDN URL, re-upload it as a fresh
    // file via `files`, and set the embed's image back to
    // `attachment://lineup.png`. This re-establishes the claim.
    const imageUrl = old.image?.url;
    logger.info(`Editing lineup ${messageId} (${server || 'legacy'}): image=${imageUrl}, attachments=${oldMsg.attachments.size}`);

    const updated = EmbedBuilder.from(old);
    updated.setFooter({ text: newCaption });

    if (imageUrl) {
      const res = await fetch(imageUrl);
      if (!res.ok) throw new Error(`Failed to download lineup image: ${res.status}`);
      const buffer = Buffer.from(await res.arrayBuffer());

      updated.setImage('attachment://lineup.png');
      await oldMsg.edit({
        embeds:      [updated],
        files:       [{ attachment: buffer, name: 'lineup.png' }],
        attachments: []
      });
    } else {
      await oldMsg.edit({ embeds: [updated] });
    }

    saveLineupData(channelId, messageId, newCaption, server);

    logger.info(`${interaction.user.tag} updated lineup caption to: ${newCaption}`);
    await interaction.reply({ content: `\u2705 Caption updated to: **${newCaption}**`, flags: 64 });
  } catch (err) {
    logger.error('Failed to edit lineup caption:', err);
    await interaction.reply({ content: '\u274c Could not edit the message. It may be too old or I lack permissions.', flags: 64 });
  }
}

// ── Edit Server Button (from Post Server ephemeral reply) ─────────────────────

async function handleLineupEditServerButton(interaction) {
  const parts     = interaction.customId.split(':');
  const channelId = parts[1];
  const messageId = parts[2];

  // Try cache first (instant, no API calls)
  const cached = loadServerData(channelId);
  let currentName = cached?.serverName     ?? process.env.SERVER_NAME     ?? 'HCIA EU 1';
  let currentPass = cached?.serverPassword ?? process.env.SERVER_PASSWORD ?? 'MWFTIME';

  // If no cache or different message, try fetching
  if (!cached || cached.messageId !== messageId) {
    try {
      const ch     = await interaction.client.channels.fetch(channelId);
      const msg    = await ch.messages.fetch(messageId);
      const fields = msg.embeds[0]?.fields ?? [];
      currentName  = fields.find(f => f.name.includes('Server Name'))?.value ?? currentName;
      currentPass  = fields.find(f => f.name.includes('Password'))?.value   ?? currentPass;
      saveServerData(channelId, messageId, currentName, currentPass);
    } catch (_) {}
  }

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
        { name: '\ud83d\udccc Server Name', value: newName, inline: true },
        { name: '\ud83d\udd12 Password',    value: newPass, inline: true }
      );

    await msg.edit({ embeds: [updated] });

    // Update cache
    saveServerData(channelId, messageId, newName, newPass);

    logger.info(`${interaction.user.tag} updated server details: ${newName} / ${newPass}`);
    await interaction.reply({
      content: `\u2705 Server details updated!\n**Server Name:** ${newName}\n**Password:** ${newPass}`,
      flags: 64
    });
  } catch (err) {
    logger.error('Failed to edit server details:', err);
    await interaction.reply({ content: '\u274c Could not edit the message. It may be too old or I lack permissions.', flags: 64 });
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
      { name: '\ud83d\udccc Server Name', value: serverName,     inline: true },
      { name: '\ud83d\udd12 Password',    value: serverPassword, inline: true }
    );

  const serverMsg = await channel.send({ embeds: [serverEmbed] });

  // Save to cache
  saveServerData(channel.id, serverMsg.id, serverName, serverPassword);

  logger.info(`${interaction.user.tag} posted server details to #${channel.name}`);

  await sendLog(interaction.client, new EmbedBuilder()
    .setColor(0x011327)
    .setTitle('\ud83d\udda5\ufe0f Server Details Posted')
    .addFields(
      { name: '\ud83d\udc64 Admin',   value: `<@${interaction.user.id}>`, inline: true },
      { name: '\ud83d\udccc Channel', value: `<#${channel.id}>`,          inline: true }
    )
    .setTimestamp()
  );

  const editBtn = new ButtonBuilder()
    .setCustomId(`lineup_editserver:${channel.id}:${serverMsg.id}`)
    .setLabel('Edit Server Details')
    .setStyle(ButtonStyle.Secondary)
    .setEmoji('\u270f\ufe0f');

  return interaction.editReply({
    embeds: [createSuccessEmbed('Server Details Posted', `Posted to <#${channel.id}>!`)],
    components: [new ActionRowBuilder().addComponents(editBtn)]
  });
}

// ── Admin: Edit Lineup Caption (panel button) ─────────────────────────────────
// Accepts server tag from button customId: admin_edit_caption:S1 or admin_edit_caption:S2

async function handleAdminEditCaption(interaction) {
  const server    = interaction.customId.split(':')[1] || null; // S1 | S2 | null
  const channelId = process.env.LINEUP_CHANNEL || interaction.channelId;

  const cached = loadLineupData(channelId, server);
  if (cached) {
    const serverSuffix = server ? `:${server}` : '';
    const modal = new ModalBuilder()
      .setCustomId(`lineup_caption:${channelId}:${cached.messageId}${serverSuffix}`)
      .setTitle(server ? `Edit Lineup Caption (${server})` : 'Edit Lineup Caption');

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('caption_text')
          .setLabel('Caption')
          .setStyle(TextInputStyle.Short)
          .setValue(cached.caption)
          .setMaxLength(100)
          .setRequired(true)
      )
    );

    return interaction.showModal(modal);
  }

  // No cache \u2014 scan channel for the most recent lineup with an image
  await interaction.deferReply({ flags: 64 });

  const ch = await interaction.client.channels.fetch(channelId).catch(() => null);
  if (!ch) {
    return interaction.editReply({
      embeds: [createErrorEmbed('Config Error', 'LINEUP_CHANNEL not found. Check your .env.')]
    });
  }

  const msg = await findLastBotMessage(ch, m => m.embeds.some(e => e.image));
  if (!msg) {
    return interaction.editReply({
      content: `\u274c No lineup message found${server ? ` for ${server}` : ''}. Post one with \`/lineup\` first.`
    });
  }

  const caption = msg.embeds[0]?.footer?.text ?? 'Midweek Frontline \u2013 Lineup \u2013 ';
  saveLineupData(channelId, msg.id, caption, server);

  await interaction.editReply({
    content: `\u2705 Lineup data loaded${server ? ` for ${server}` : ''}. **Click the button again** to open the editor.`
  });
}

// ── Admin: Edit Server Details (panel button) ─────────────────────────────────
// Uses cache to avoid channel scan before showModal() (3-second timeout).

async function handleAdminEditServer(interaction) {
  const channelId = process.env.SERVER_DETAILS_CHANNEL || interaction.channelId;

  // Try cache first \u2014 instant, no API calls before showModal()
  const cached = loadServerData(channelId);
  if (cached) {
    const modal = new ModalBuilder()
      .setCustomId(`lineup_server:${channelId}:${cached.messageId}`)
      .setTitle('Edit Server Details');

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('server_name')
          .setLabel('Server Name')
          .setStyle(TextInputStyle.Short)
          .setValue(cached.serverName)
          .setMaxLength(100)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('server_password')
          .setLabel('Password')
          .setStyle(TextInputStyle.Short)
          .setValue(cached.serverPassword)
          .setMaxLength(100)
          .setRequired(true)
      )
    );

    return interaction.showModal(modal);
  }

  // No cache \u2014 scan channel, save for next click, tell user to retry
  await interaction.deferReply({ flags: 64 });

  const ch = await interaction.client.channels.fetch(channelId).catch(() => null);
  if (!ch) {
    return interaction.editReply({
      embeds: [createErrorEmbed('Config Error', 'SERVER_DETAILS_CHANNEL not found. Check your .env.')]
    });
  }

  const msg = await findLastBotMessage(ch, m => m.embeds.some(e => e.title === 'Server Details'));
  if (!msg) {
    return interaction.editReply({
      content: '\u274c No Server Details message found. Post one first using **Post Server Details**.'
    });
  }

  const fields      = msg.embeds[0]?.fields ?? [];
  const serverName  = fields.find(f => f.name.includes('Server Name'))?.value ?? (process.env.SERVER_NAME || 'HCIA EU 1');
  const serverPass  = fields.find(f => f.name.includes('Password'))?.value   ?? (process.env.SERVER_PASSWORD || 'MWFTIME');
  saveServerData(channelId, msg.id, serverName, serverPass);

  await interaction.editReply({
    content: '\u2705 Server data loaded. **Click "Edit Server Details" again** to open the editor.'
  });
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
