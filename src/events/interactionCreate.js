const { PermissionFlagsBits, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const logger = require('../utils/logger');
const { createFactionEmbed, createSuccessEmbed, createErrorEmbed } = require('../utils/embeds');
const { createFactionButtons } = require('../utils/buttons');

const THUMBNAIL_URL = 'https://raw.githubusercontent.com/janush7/faction-bot/main/assets/MWF.png';

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

        if (customId === 'admin_reset')         return await handleAdminResetConfirm(interaction);
        if (customId === 'admin_reset_confirm') return await handleAdminReset(interaction);
        if (customId === 'admin_reset_cancel')  return await handleAdminResetCancel(interaction);
        if (customId === 'admin_reload')        return await handleAdminReload(interaction);
        if (customId === 'admin_clearlogs')     return await handleAdminClearLogs(interaction);
        if (customId === 'admin_post_server')   return await handleAdminPostServer(interaction);
        if (customId === 'admin_edit_caption')  return await handleAdminEditCaption(interaction);
        if (customId === 'admin_edit_server')   return await handleAdminEditServer(interaction);
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
