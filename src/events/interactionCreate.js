const { PermissionFlagsBits, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const logger = require('../utils/logger');
const { createFactionEmbed, createSuccessEmbed, createErrorEmbed } = require('../utils/embeds');
const { createFactionButtons } = require('../utils/buttons');

const THUMBNAIL_URL = 'https://raw.githubusercontent.com/janush7/faction-bot/main/assets/MWF.png';

// Default NODES embed content
const DEFAULT_NODES = [
  {
    name: 'North / West HQ',
    value: '• North/West Squad — 2x Supply Box\n• Flex Defence — 1x Supply Box, 1x Engineer'
  },
  {
    name: 'Mid HQ',
    value: '• Meatgrind — 2x Supply Box\n• Flex Attack — 1x Supply Box, 1x Engineer'
  },
  {
    name: 'South / East HQ',
    value: '• South/East Squad — 2x Supply Box\n• Defence — 1x Supply Box, 1x Engineer'
  },
  {
    name: 'Arty',
    value: '• Medium Tank Crew - 1x Supply Box'
  }
];

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {

    // ── Slash Commands ────────────────────────────────────────────────────────
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command) return;
      try {
        await command.execute(interaction);
      } catch (error) {
        logger.error(`Error executing /${interaction.commandName}:`, error);
        const reply = { content: '❌ An error occurred.', flags: 64 };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(reply).catch(() => {});
        } else {
          await interaction.reply(reply).catch(() => {});
        }
      }
      return;
    }

    // ── Modal Submits ─────────────────────────────────────────────────────────
    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith('lineup_caption:'))  return await handleLineupCaptionSubmit(interaction);
      if (interaction.customId.startsWith('lineup_server:'))   return await handleServerModalSubmit(interaction);
      if (interaction.customId === 'nodes_edit')               return await handleNodesModalSubmit(interaction);
      if (interaction.customId.startsWith('rotation_edit:'))   return await handleRotationModalSubmit(interaction);
      return;
    }

    if (!interaction.isButton()) return;

    const { customId } = interaction;

    try {
      // ── Lineup Edit Caption Button (from /lineup ephemeral reply) ─────────
      if (customId.startsWith('lineup_editcap:'))    return await handleLineupEditCapButton(interaction);

      // ── Faction Buttons ───────────────────────────────────────────────────
      if (customId === 'faction_allies' || customId === 'faction_axis') {
        return await handleFactionSelection(interaction, customId === 'faction_allies' ? 'allies' : 'axis');
      }

      // ── Admin Buttons ─────────────────────────────────────────────────────
      if (customId.startsWith('admin_')) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
          return interaction.reply({
            embeds: [createErrorEmbed('Permission Denied', 'Only administrators can use these controls.')],
            flags: 64
          });
        }

        if (customId === 'admin_reset')          return await handleAdminResetConfirm(interaction);
        if (customId === 'admin_reset_confirm')  return await handleAdminReset(interaction);
        if (customId === 'admin_reset_cancel')   return await handleAdminResetCancel(interaction);
        if (customId === 'admin_reload')         return await handleAdminReload(interaction);
        if (customId === 'admin_clearlogs')      return await handleAdminClearLogs(interaction);
        if (customId === 'admin_post_server')    return await handleAdminPostServer(interaction);
        if (customId === 'admin_edit_caption')   return await handleAdminEditCaption(interaction);
        if (customId === 'admin_edit_server')    return await handleAdminEditServer(interaction);
        if (customId === 'admin_post_nodes')     return await handleAdminPostNodes(interaction);
        if (customId === 'admin_edit_nodes')     return await handleAdminEditNodes(interaction);
        if (customId === 'admin_post_rotation')  return await handleAdminPostRotation(interaction);
        if (customId === 'admin_edit_rotation')  return await handleAdminEditRotation(interaction);
      }

    } catch (error) {
      logger.error('Error handling button interaction:', error);
      const reply = { content: '❌ An error occurred.', flags: 64 };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply).catch(() => {});
      } else {
        await interaction.reply(reply).catch(() => {});
      }
    }
  }
};

// ── Helpers ───────────────────────────────────────────────────────────────────

async function sendLog(client, embed) {
  const logChannelId = process.env.ADMIN_LOG_CHANNEL;
  if (!logChannelId) return;
  try {
    const channel = await client.channels.fetch(logChannelId);
    if (channel?.isTextBased()) await channel.send({ embeds: [embed] });
  } catch (err) {
    logger.warn(`Could not send log to admin channel: ${err.message}`);
  }
}

async function bulkDeleteFiltered(channel, filterFn) {
  let deleted = 0;
  while (true) {
    const fetched = await channel.messages.fetch({ limit: 100 });
    if (fetched.size === 0) break;
    const toDelete = fetched.filter(filterFn);
    if (toDelete.size === 0) break;
    const result = await channel.bulkDelete(toDelete, true).catch(() => null);
    const count = result ? result.size : 0;
    deleted += count;
    if (count === 0 || fetched.size < 100) break;
  }
  return deleted;
}

async function findLastBotMessage(channel, predicate, limit = 50) {
  const messages = await channel.messages.fetch({ limit });
  return messages.find(m => m.author.id === channel.client.user.id && predicate(m)) ?? null;
}

function getNodesChannelIds() {
  const env = process.env.NODES_CHANNELS || '';
  return env.split(',').map(id => id.trim()).filter(Boolean);
}

function buildNodesEmbed(fields) {
  return new EmbedBuilder()
    .setTitle('NODES')
    .setColor(0x011327)
    .setThumbnail(THUMBNAIL_URL)
    .addFields(fields);
}

// ── Map Rotation Helpers ──────────────────────────────────────────────────────

function getMapRotationChannelId() {
  return process.env.MAP_ROTATION_CHANNEL || null;
}

function getDefaultRotationData() {
  const now = new Date();
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
 * Converts lines matching "DD/MM/YYYY - MapName" to Discord timestamps.
 * Lines that don't match the pattern are left unchanged.
 * Time is hardcoded to 20:00 Europe/Warsaw.
 */
function parseEventLines(text) {
  return text.split('\n').map(line => {
    const match = line.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})\s*-\s*(.+)$/);
    if (!match) return line.trim();
    const [, dd, mm, yyyy, mapName] = match;
    const m = parseInt(mm, 10);
    // Europe/Warsaw: CEST (UTC+2) April–October, CET (UTC+1) otherwise
    const offsetHours = (m >= 4 && m <= 10) ? 2 : 1;
    const utcHour = 20 - offsetHours;
    const unix = Math.floor(
      new Date(`${yyyy}-${mm}-${dd}T${String(utcHour).padStart(2, '0')}:00:00Z`).getTime() / 1000
    );
    return `<t:${unix}:F> - **${mapName.trim()}**`;
  }).join('\n');
}

function buildRotationEmbed(data) {
  return new EmbedBuilder()
    .setAuthor({ name: 'MWF Map Rotation', iconURL: THUMBNAIL_URL })
    .setColor(0x011327)
    .addFields(
      { name: data.month1Header, value: data.month1Events || '—', inline: false },
      { name: data.month2Header, value: data.month2Events || '—', inline: false }
    );
}

// ── Lineup Caption Edit (from /lineup ephemeral reply button) ─────────────────

async function handleLineupEditCapButton(interaction) {
  const parts = interaction.customId.split(':');
  const channelId = parts[1];
  const messageId = parts[2];

  let currentCaption = 'Midweek Frontline – Lineup – ';
  try {
    const ch = await interaction.client.channels.fetch(channelId);
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
  const parts = interaction.customId.split(':');
  const channelId = parts[1];
  const messageId = parts[2];
  const newCaption = interaction.fields.getTextInputValue('caption_text');

  try {
    const ch = await interaction.client.channels.fetch(channelId);
    const msg = await ch.messages.fetch(messageId);
    const old = msg.embeds[0];

    const updated = new EmbedBuilder()
      .setColor(old.color)
      .addFields(...old.fields)
      .setImage('attachment://lineup.png')
      .setFooter({ text: newCaption });

    if (old.thumbnail) updated.setThumbnail(old.thumbnail.url);

    await msg.edit({ embeds: [updated] });
    logger.info(`${interaction.user.tag} updated lineup caption to: ${newCaption}`);
    await interaction.reply({ content: `✅ Caption updated to: **${newCaption}**`, flags: 64 });
  } catch (err) {
    logger.error('Failed to edit lineup caption:', err);
    await interaction.reply({ content: '❌ Could not edit the message. It may be too old or I lack permissions.', flags: 64 });
  }
}

// ── Server Details Modal Submit ───────────────────────────────────────────────

async function handleServerModalSubmit(interaction) {
  const parts = interaction.customId.split(':');
  const channelId = parts[1];
  const messageId = parts[2];
  const newName = interaction.fields.getTextInputValue('server_name');
  const newPass = interaction.fields.getTextInputValue('server_password');

  try {
    const ch = await interaction.client.channels.fetch(channelId);
    const msg = await ch.messages.fetch(messageId);

    const updated = new EmbedBuilder()
      .setTitle('Server Details')
      .setColor(0x011325)
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

// ── NODES Modal Submit ────────────────────────────────────────────────────────

async function handleNodesModalSubmit(interaction) {
  await interaction.deferReply({ flags: 64 });

  const fields = [
    { name: 'North / West HQ', value: interaction.fields.getTextInputValue('nodes_nw')   || '—' },
    { name: 'Mid HQ',          value: interaction.fields.getTextInputValue('nodes_mid')  || '—' },
    { name: 'South / East HQ', value: interaction.fields.getTextInputValue('nodes_se')   || '—' },
    { name: 'Arty',            value: interaction.fields.getTextInputValue('nodes_arty') || '—' }
  ];

  const updatedEmbed = buildNodesEmbed(fields);
  const channelIds = getNodesChannelIds();

  if (!channelIds.length) {
    return interaction.editReply({ embeds: [createErrorEmbed('Config Error', 'NODES_CHANNELS is not set in .env.')] });
  }

  let edited = 0;
  let failed = 0;

  for (const channelId of channelIds) {
    try {
      const ch = await interaction.client.channels.fetch(channelId);
      const msg = await findLastBotMessage(ch, m => m.embeds.some(e => e.title === 'NODES'));
      if (msg) {
        await msg.edit({ embeds: [updatedEmbed] });
        edited++;
      } else {
        failed++;
        logger.warn(`No NODES message found in channel ${channelId}`);
      }
    } catch (err) {
      failed++;
      logger.error(`Failed to edit NODES in channel ${channelId}: ${err.message}`);
    }
  }

  logger.info(`${interaction.user.tag} edited NODES embed — ${edited} updated, ${failed} failed`);

  await sendLog(interaction.client, new EmbedBuilder()
    .setColor(0x011327)
    .setTitle('📍 Nodes Embed Edited')
    .addFields(
      { name: '👤 Admin',     value: `<@${interaction.user.id}>`, inline: true },
      { name: '✅ Updated',   value: `${edited}`,                  inline: true },
      { name: '❌ Failed',    value: `${failed}`,                  inline: true }
    )
    .setTimestamp()
  );

  return interaction.editReply({
    embeds: [createSuccessEmbed('Nodes Updated', `Updated **${edited}** message(s).${failed ? `\n⚠️ ${failed} channel(s) had no existing NODES message.` : ''}`)]
  });
}

// ── Map Rotation Modal Submit ─────────────────────────────────────────────────

async function handleRotationModalSubmit(interaction) {
  await interaction.deferReply({ flags: 64 });

  const parts = interaction.customId.split(':');
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
    const ch = await interaction.client.channels.fetch(channelId);
    const msg = await ch.messages.fetch(messageId);
    await msg.edit({ embeds: [updatedEmbed] });

    logger.info(`${interaction.user.tag} updated Map Rotation embed in #${ch.name}`);

    await sendLog(interaction.client, new EmbedBuilder()
      .setColor(0x011327)
      .setTitle('🗺️ Map Rotation Edited')
      .addFields(
        { name: '👤 Admin',   value: `<@${interaction.user.id}>`, inline: true },
        { name: '📌 Channel', value: `<#${channelId}>`,           inline: true }
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

// ── Faction Selection ─────────────────────────────────────────────────────────

async function handleFactionSelection(interaction, faction) {
  const alliesRoleId = process.env.ALLIES_ROLE;
  const axisRoleId  = process.env.AXIS_ROLE;
  const member = interaction.member;

  const selectedRoleId = faction === 'allies' ? alliesRoleId : axisRoleId;
  const oppositeRoleId = faction === 'allies' ? axisRoleId  : alliesRoleId;
  const factionLabel   = faction === 'allies' ? '🔵 Allies' : '🔴 Axis';
  const factionColor   = faction === 'allies' ? 0x3b82f6 : 0xef4444;

  if (!selectedRoleId) {
    return interaction.reply({
      embeds: [createErrorEmbed('Config Error', 'Faction roles are not configured. Ask an admin to set ALLIES_ROLE / AXIS_ROLE.')],
      flags: 64
    });
  }

  if (member.roles.cache.has(selectedRoleId)) {
    return interaction.reply({ content: `⚠️ You are already on **${factionLabel}**!`, flags: 64 });
  }

  const switched = oppositeRoleId && member.roles.cache.has(oppositeRoleId);
  if (switched) {
    await member.roles.remove(oppositeRoleId).catch(e =>
      logger.warn(`Could not remove opposite role from ${interaction.user.tag}: ${e.message}`)
    );
  }

  await member.roles.add(selectedRoleId);
  logger.info(`${interaction.user.tag} joined ${factionLabel}`);

  const logEmbed = new EmbedBuilder()
    .setColor(factionColor)
    .setTitle(`${factionLabel} — Faction Selected`)
    .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
    .addFields(
      { name: '👤 User',     value: `<@${interaction.user.id}>`, inline: true },
      { name: '🏳️ Faction', value: factionLabel,                 inline: true },
      { name: '🔄 Switched', value: switched ? 'Yes' : 'No',     inline: true }
    )
    .setTimestamp();

  await sendLog(interaction.client, logEmbed);

  return interaction.reply({
    content: `✅ You have joined **${factionLabel}**! Good luck on the battlefield!`,
    flags: 64
  });
}

// ── Admin: Reset Confirmation ─────────────────────────────────────────────────

async function handleAdminResetConfirm(interaction) {
  const confirmEmbed = new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle('⚠️ Confirm Role Reset')
    .setDescription('This will remove **all Allies and Axis roles** from every member.\n\nAre you sure?');

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('admin_reset_confirm')
      .setLabel('Confirm')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('admin_reset_cancel')
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary)
  );

  return interaction.reply({ embeds: [confirmEmbed], components: [row], flags: 64 });
}

async function handleAdminResetCancel(interaction) {
  return interaction.update({
    embeds: [createErrorEmbed('Cancelled', 'Role reset was cancelled.')],
    components: []
  });
}

async function handleAdminReset(interaction) {
  await interaction.update({
    embeds: [new EmbedBuilder().setColor(0x011327).setDescription('⏳ Resetting faction roles...')],
    components: []
  });

  const alliesRoleId = process.env.ALLIES_ROLE;
  const axisRoleId  = process.env.AXIS_ROLE;
  const guild = interaction.guild;

  let count = 0;
  const errors = [];

  await guild.members.fetch();

  for (const roleId of [alliesRoleId, axisRoleId].filter(Boolean)) {
    const role = guild.roles.cache.get(roleId);
    if (!role) continue;
    const membersWithRole = [...role.members.values()];
    if (!membersWithRole.length) continue;

    const results = await Promise.allSettled(membersWithRole.map(m => m.roles.remove(roleId)));
    for (let i = 0; i < results.length; i++) {
      if (results[i].status === 'fulfilled') count++;
      else errors.push(`${membersWithRole[i].user.tag}: ${results[i].reason?.message}`);
    }
  }

  logger.info(`${interaction.user.tag} reset faction roles — ${count} removal(s), ${errors.length} error(s)`);

  const logEmbed = new EmbedBuilder()
    .setColor(0x011327)
    .setTitle('🔁 Manual Faction Reset')
    .addFields(
      { name: '👤 Admin',        value: `<@${interaction.user.id}>`, inline: true },
      { name: '✅ Roles Removed', value: `${count}`,                  inline: true },
      { name: '❌ Errors',        value: `${errors.length}`,          inline: true }
    )
    .setTimestamp();

  await sendLog(interaction.client, logEmbed);

  return interaction.editReply({
    embeds: [createSuccessEmbed('Roles Reset', `Removed **${count}** faction role(s).${errors.length ? `\n⚠️ ${errors.length} error(s) occurred.` : ''}`)],
    components: []
  });
}

// ── Admin: Reload Faction Embed ───────────────────────────────────────────────

async function handleAdminReload(interaction) {
  await interaction.deferReply({ flags: 64 });

  const channelId = process.env.FACTION_CHANNEL;
  if (!channelId) {
    return interaction.editReply({ embeds: [createErrorEmbed('Config Error', 'FACTION_CHANNEL is not set.')] });
  }

  const channel = await interaction.client.channels.fetch(channelId).catch(() => null);
  if (!channel) {
    return interaction.editReply({ embeds: [createErrorEmbed('Channel Not Found', `Could not find channel <#${channelId}>.`)] });
  }

  const deleted = await bulkDeleteFiltered(
    channel,
    msg => msg.author.id === interaction.client.user.id && msg.embeds.length > 0
  );

  await channel.send({ embeds: [createFactionEmbed()], components: [createFactionButtons()] });

  logger.info(`${interaction.user.tag} reloaded faction embed (deleted ${deleted} embed(s))`);

  await sendLog(interaction.client, new EmbedBuilder()
    .setColor(0x011327)
    .setTitle('🔄 Embed Reloaded')
    .addFields(
      { name: '👤 Admin',          value: `<@${interaction.user.id}>`, inline: true },
      { name: '📌 Channel',        value: `<#${channelId}>`,           inline: true },
      { name: '🗑️ Embeds Deleted', value: `${deleted}`,               inline: true }
    )
    .setTimestamp()
  );

  return interaction.editReply({
    embeds: [createSuccessEmbed('Embed Reloaded', `Cleared **${deleted}** embed(s) and posted a fresh embed in <#${channelId}>.`)]
  });
}

// ── Admin: Clear Logs ─────────────────────────────────────────────────────────

async function handleAdminClearLogs(interaction) {
  await interaction.deferReply({ flags: 64 });

  const logChannelId = process.env.ADMIN_LOG_CHANNEL;
  if (!logChannelId) {
    return interaction.editReply({ embeds: [createSuccessEmbed('No Log Channel', 'ADMIN_LOG_CHANNEL is not configured.')] });
  }

  const channel = await interaction.client.channels.fetch(logChannelId).catch(() => null);
  if (!channel) {
    return interaction.editReply({ embeds: [createErrorEmbed('Channel Not Found', `Could not find log channel <#${logChannelId}>.`)] });
  }

  const deleted = await bulkDeleteFiltered(channel, () => true);
  logger.info(`${interaction.user.tag} cleared ${deleted} log message(s)`);

  return interaction.editReply({
    embeds: [createSuccessEmbed('Logs Cleared', `Deleted **${deleted}** message(s) from the log channel.`)]
  });
}

// ── Admin: Post Server Details ────────────────────────────────────────────────

async function handleAdminPostServer(interaction) {
  await interaction.deferReply({ flags: 64 });

  const channelId = process.env.SERVER_DETAILS_CHANNEL;
  const channel = channelId
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
    .setColor(0x011325)
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
  const ch = await interaction.client.channels.fetch(channelId).catch(() => null);

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
  const ch = await interaction.client.channels.fetch(channelId).catch(() => null);

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

// ── Admin: Post Nodes ─────────────────────────────────────────────────────────

async function handleAdminPostNodes(interaction) {
  await interaction.deferReply({ flags: 64 });

  const channelIds = getNodesChannelIds();

  if (!channelIds.length) {
    return interaction.editReply({
      embeds: [createErrorEmbed('Config Error', 'NODES_CHANNELS is not set in .env.')]
    });
  }

  const nodesEmbed = buildNodesEmbed(DEFAULT_NODES);
  let posted = 0;
  let failed = 0;
  const postedChannels = [];

  for (const channelId of channelIds) {
    try {
      const ch = await interaction.client.channels.fetch(channelId);
      await ch.send({ embeds: [nodesEmbed] });
      postedChannels.push(`<#${channelId}>`);
      posted++;
    } catch (err) {
      failed++;
      logger.error(`Failed to post NODES to channel ${channelId}: ${err.message}`);
    }
  }

  logger.info(`${interaction.user.tag} posted NODES embed to ${posted} channel(s)`);

  await sendLog(interaction.client, new EmbedBuilder()
    .setColor(0x011327)
    .setTitle('📍 Nodes Embed Posted')
    .addFields(
      { name: '👤 Admin',    value: `<@${interaction.user.id}>`,       inline: true },
      { name: '📌 Channels', value: postedChannels.join(', ') || '—', inline: true },
      { name: '❌ Failed',   value: `${failed}`,                        inline: true }
    )
    .setTimestamp()
  );

  return interaction.editReply({
    embeds: [createSuccessEmbed(
      'Nodes Posted',
      `Posted to ${postedChannels.join(', ')}.${failed ? `\n⚠️ Failed to post to ${failed} channel(s).` : ''}`
    )]
  });
}

// ── Admin: Edit Nodes (panel button) ─────────────────────────────────────────

async function handleAdminEditNodes(interaction) {
  const channelIds = getNodesChannelIds();

  if (!channelIds.length) {
    return interaction.reply({
      embeds: [createErrorEmbed('Config Error', 'NODES_CHANNELS is not set in .env.')],
      flags: 64
    });
  }

  // Find current content from first available channel
  let currentFields = DEFAULT_NODES;
  for (const channelId of channelIds) {
    try {
      const ch = await interaction.client.channels.fetch(channelId);
      const msg = await findLastBotMessage(ch, m => m.embeds.some(e => e.title === 'NODES'));
      if (msg?.embeds[0]?.fields?.length) {
        currentFields = msg.embeds[0].fields;
        break;
      }
    } catch (_) {}
  }

  const getValue = (index) => currentFields[index]?.value ?? '';

  const modal = new ModalBuilder()
    .setCustomId('nodes_edit')
    .setTitle('Edit Nodes');

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('nodes_nw')
        .setLabel('North / West HQ')
        .setStyle(TextInputStyle.Paragraph)
        .setValue(getValue(0))
        .setMaxLength(500)
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('nodes_mid')
        .setLabel('Mid HQ')
        .setStyle(TextInputStyle.Paragraph)
        .setValue(getValue(1))
        .setMaxLength(500)
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('nodes_se')
        .setLabel('South / East HQ')
        .setStyle(TextInputStyle.Paragraph)
        .setValue(getValue(2))
        .setMaxLength(500)
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('nodes_arty')
        .setLabel('Arty')
        .setStyle(TextInputStyle.Paragraph)
        .setValue(getValue(3))
        .setMaxLength(500)
        .setRequired(true)
    )
  );

  await interaction.showModal(modal);
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

  const data = getDefaultRotationData();
  const embed = buildRotationEmbed(data);
  await ch.send({ embeds: [embed] });

  logger.info(`${interaction.user.tag} posted Map Rotation to #${ch.name}`);

  await sendLog(interaction.client, new EmbedBuilder()
    .setColor(0x011327)
    .setTitle('🗺️ Map Rotation Posted')
    .addFields(
      { name: '👤 Admin',   value: `<@${interaction.user.id}>`, inline: true },
      { name: '📌 Channel', value: `<#${channelId}>`,           inline: true }
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
      content: '❌ No Map Rotation message found in the channel. Post one first using **Post Rotation**.',
      flags: 64
    });
  }

  const fields = msg.embeds[0]?.fields ?? [];
  const data = fields.length >= 2
    ? {
        month1Header: fields[0].name,
        month1Events: fields[0].value,
        month2Header: fields[1].name,
        month2Events: fields[1].value
      }
    : getDefaultRotationData();

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
