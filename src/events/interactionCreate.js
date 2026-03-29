const { PermissionFlagsBits, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const logger = require('../utils/logger');
const { createFactionEmbed, createSuccessEmbed, createErrorEmbed } = require('../utils/embeds');
const { createFactionButtons } = require('../utils/buttons');

const THUMBNAIL_URL = 'https://raw.githubusercontent.com/janush7/faction-bot/main/assets/MWF.png';

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {

    // ── Slash Commands ──────────────────────────────────────────────────────
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command) return;
      try {
        await command.execute(interaction);
      } catch (error) {
        logger.error(`Error executing /${interaction.commandName}:`, error);
        const reply = { content: '❌ An error occurred.', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(reply).catch(() => {});
        } else {
          await interaction.reply(reply).catch(() => {});
        }
      }
      return;
    }

    // ── Modal Submits ───────────────────────────────────────────────────────
    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith('lineup_caption:')) {
        return await handleLineupCaptionSubmit(interaction);
      }
      if (interaction.customId.startsWith('lineup_server:')) {
        return await handleServerModalSubmit(interaction);
      }
      return;
    }

    if (!interaction.isButton()) return;

    const { customId } = interaction;

    try {
      // ── Lineup Edit Caption Button ────────────────────────────────────────
      if (customId.startsWith('lineup_editcap:')) {
        return await handleLineupEditCapButton(interaction);
      }

      // ── Lineup Edit Server Details Button ────────────────────────────────
      if (customId.startsWith('lineup_editserver:')) {
        return await handleServerEditButton(interaction);
      }

      // ── Faction Buttons ───────────────────────────────────────────────────
      if (customId === 'faction_allies' || customId === 'faction_axis') {
        const faction = customId === 'faction_allies' ? 'allies' : 'axis';
        return await handleFactionSelection(interaction, faction);
      }

      // ── Admin Buttons ─────────────────────────────────────────────────────
      if (customId.startsWith('admin_')) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
          return interaction.reply({
            embeds: [createErrorEmbed('Permission Denied', 'Only administrators can use these controls.')],
            ephemeral: true
          });
        }

        if (customId === 'admin_reset')     return await handleAdminReset(interaction);
        if (customId === 'admin_reload')    return await handleAdminReload(interaction);
        if (customId === 'admin_clearlogs') return await handleAdminClearLogs(interaction);
      }

    } catch (error) {
      logger.error('Error handling button interaction:', error);
      const reply = { content: '❌ An error occurred.', ephemeral: true };
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

    if (count === 0) break;
    if (fetched.size < 100) break;
  }

  return deleted;
}

// ── Lineup Caption Edit ───────────────────────────────────────────────────────

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

  const input = new TextInputBuilder()
    .setCustomId('caption_text')
    .setLabel('Caption')
    .setStyle(TextInputStyle.Short)
    .setValue(currentCaption)
    .setMaxLength(100)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(input));
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
    await interaction.reply({ content: `✅ Caption updated to: **${newCaption}**`, ephemeral: true });
  } catch (err) {
    logger.error('Failed to edit lineup caption:', err);
    await interaction.reply({ content: '❌ Could not edit the message. It may be too old or I lack permissions.', ephemeral: true });
  }
}

// ── Server Details Edit ───────────────────────────────────────────────────────

async function handleServerEditButton(interaction) {
  const parts = interaction.customId.split(':');
  const channelId = parts[1];
  const messageId = parts[2];

  let currentName = process.env.SERVER_NAME || 'HCIA EU 1';
  let currentPass = process.env.SERVER_PASSWORD || 'MWFTIME';

  try {
    const ch = await interaction.client.channels.fetch(channelId);
    const msg = await ch.messages.fetch(messageId);
    const fields = msg.embeds[0]?.fields ?? [];
    const nameField = fields.find(f => f.name.includes('Server Name'));
    const passField = fields.find(f => f.name.includes('Password'));
    if (nameField) currentName = nameField.value;
    if (passField) currentPass = passField.value;
  } catch (_) {}

  const modal = new ModalBuilder()
    .setCustomId(`lineup_server:${channelId}:${messageId}`)
    .setTitle('Edit Server Details');

  const nameInput = new TextInputBuilder()
    .setCustomId('server_name')
    .setLabel('Server Name')
    .setStyle(TextInputStyle.Short)
    .setValue(currentName)
    .setMaxLength(100)
    .setRequired(true);

  const passInput = new TextInputBuilder()
    .setCustomId('server_password')
    .setLabel('Password')
    .setStyle(TextInputStyle.Short)
    .setValue(currentPass)
    .setMaxLength(100)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(nameInput),
    new ActionRowBuilder().addComponents(passInput)
  );

  await interaction.showModal(modal);
}

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
      ephemeral: true
    });
  } catch (err) {
    logger.error('Failed to edit server details:', err);
    await interaction.reply({
      content: '❌ Could not edit the message. It may be too old or I lack permissions.',
      ephemeral: true
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
      ephemeral: true
    });
  }

  if (member.roles.cache.has(selectedRoleId)) {
    return interaction.reply({
      content: `⚠️ You are already on **${factionLabel}**!`,
      ephemeral: true
    });
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
      { name: '🏳️ Faction', value: factionLabel, inline: true },
      { name: '🔄 Switched', value: switched ? 'Yes' : 'No', inline: true }
    )
    .setTimestamp();

  await sendLog(interaction.client, logEmbed);

  return interaction.reply({
    content: `✅ You have joined **${factionLabel}**! Good luck on the battlefield!`,
    ephemeral: true
  });
}

async function handleAdminReset(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const alliesRoleId = process.env.ALLIES_ROLE;
  const axisRoleId  = process.env.AXIS_ROLE;
  const guild = interaction.guild;

  let count = 0;
  const errors = [];

  // Fetch only members who actually have each role — much faster than fetching everyone
  const rolesToReset = [alliesRoleId, axisRoleId].filter(Boolean);

  for (const roleId of rolesToReset) {
    const role = await guild.roles.fetch(roleId).catch(() => null);
    if (!role) continue;

    // Fetch members with this role
    const members = await guild.members.fetch({ force: false });
    const withRole = members.filter(m => m.roles.cache.has(roleId));

    for (const [, member] of withRole) {
      await member.roles.remove(roleId).catch(e => {
        errors.push(`${member.user.tag}: ${e.message}`);
      });
      count++;
    }
  }

  // Deduplicate count (member could have had both roles)
  // count here is number of role removals, not unique members
  logger.info(`${interaction.user.tag} reset faction roles — ${count} role removal(s), ${errors.length} error(s)`);

  const logEmbed = new EmbedBuilder()
    .setColor(0x011327)
    .setTitle('🔁 Manual Faction Reset')
    .addFields(
      { name: '👤 Admin',           value: `<@${interaction.user.id}>`, inline: true },
      { name: '✅ Roles Removed',    value: `${count}`,                  inline: true },
      { name: '❌ Errors',           value: `${errors.length}`,          inline: true }
    )
    .setTimestamp();

  await sendLog(interaction.client, logEmbed);

  return interaction.editReply({
    embeds: [createSuccessEmbed('Roles Reset', `Removed **${count}** faction role(s).${errors.length ? `\n⚠️ ${errors.length} error(s) occurred.` : ''}`)]
  });
}

async function handleAdminReload(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const channelId = process.env.FACTION_CHANNEL;
  if (!channelId) {
    return interaction.editReply({
      embeds: [createErrorEmbed('Config Error', 'FACTION_CHANNEL is not set in environment variables.')]
    });
  }

  const channel = await interaction.client.channels.fetch(channelId).catch(() => null);
  if (!channel) {
    return interaction.editReply({
      embeds: [createErrorEmbed('Channel Not Found', `Could not find channel <#${channelId}>.`)]
    });
  }

  const deleted = await bulkDeleteFiltered(
    channel,
    msg => msg.author.id === interaction.client.user.id && msg.embeds.length > 0
  );

  await channel.send({
    embeds: [createFactionEmbed()],
    components: [createFactionButtons()]
  });

  logger.info(`${interaction.user.tag} reloaded faction embed in #${channel.name} (deleted ${deleted} embed(s))`);

  const logEmbed = new EmbedBuilder()
    .setColor(0x011327)
    .setTitle('🔄 Embed Reloaded')
    .addFields(
      { name: '👤 Admin',          value: `<@${interaction.user.id}>`, inline: true },
      { name: '📌 Channel',        value: `<#${channelId}>`,           inline: true },
      { name: '🗑️ Embeds Deleted', value: `${deleted}`,               inline: true }
    )
    .setTimestamp();

  await sendLog(interaction.client, logEmbed);

  return interaction.editReply({
    embeds: [createSuccessEmbed('Embed Reloaded', `Cleared **${deleted}** embed(s) and posted fresh embed in <#${channelId}>.`)]
  });
}

async function handleAdminClearLogs(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const logChannelId = process.env.ADMIN_LOG_CHANNEL;
  if (!logChannelId) {
    return interaction.editReply({
      embeds: [createSuccessEmbed('No Log Channel', 'ADMIN_LOG_CHANNEL is not configured.')]
    });
  }

  const channel = await interaction.client.channels.fetch(logChannelId).catch(() => null);
  if (!channel) {
    return interaction.editReply({
      embeds: [createErrorEmbed('Channel Not Found', `Could not find log channel <#${logChannelId}>.`)]
    });
  }

  const deleted = await bulkDeleteFiltered(channel, () => true);

  logger.info(`${interaction.user.tag} cleared ${deleted} log message(s)`);

  return interaction.editReply({
    embeds: [createSuccessEmbed('Logs Cleared', `Deleted **${deleted}** message(s) from the log channel.`)]
  });
}
