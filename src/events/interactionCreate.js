const { PermissionFlagsBits, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const logger = require('../utils/logger');
const { createFactionEmbed, createSuccessEmbed, createErrorEmbed } = require('../utils/embeds');
const { createFactionButtons } = require('../utils/buttons');

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
      return;
    }

    if (!interaction.isButton()) return;

    const { customId } = interaction;

    try {
      // ── Lineup Edit Caption Button ────────────────────────────────────────
      if (customId.startsWith('lineup_editcap:')) {
        return await handleLineupEditCapButton(interaction);
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
  // customId format: lineup_editcap:{channelId}:{messageId}
  const parts = interaction.customId.split(':');
  const channelId = parts[1];
  const messageId = parts[2];

  // Fetch current footer to prefill the modal
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
  // customId format: lineup_caption:{channelId}:{messageId}
  const parts = interaction.customId.split(':');
  const channelId = parts[1];
  const messageId = parts[2];
  const newCaption = interaction.fields.getTextInputValue('caption_text');

  try {
    const ch = await interaction.client.channels.fetch(channelId);
    const msg = await ch.messages.fetch(messageId);

    // Rebuild embed preserving all fields, just swap footer
    const old = msg.embeds[0];
    const updated = new EmbedBuilder()
      .setColor(old.color)
      .addFields(...old.fields)
      .setImage(old.image?.url ?? null)
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

  const members = await interaction.guild.members.fetch();
  let count = 0;

  for (const [, member] of members) {
    let changed = false;
    if (alliesRoleId && member.roles.cache.has(alliesRoleId)) {
      await member.roles.remove(alliesRoleId).catch(() => {});
      changed = true;
    }
    if (axisRoleId && member.roles.cache.has(axisRoleId)) {
      await member.roles.remove(axisRoleId).catch(() => {});
      changed = true;
    }
    if (changed) count++;
  }

  logger.info(`${interaction.user.tag} reset faction roles for ${count} member(s)`);

  const logEmbed = new EmbedBuilder()
    .setColor(0x011327)
    .setTitle('🔁 Manual Faction Reset')
    .addFields(
      { name: '👤 Admin',        value: `<@${interaction.user.id}>`, inline: true },
      { name: '✅ Roles Removed', value: `${count} member(s)`,       inline: true }
    )
    .setTimestamp();

  await sendLog(interaction.client, logEmbed);

  return interaction.editReply({
    embeds: [createSuccessEmbed('Roles Reset', `Removed faction roles from **${count}** member(s).`)]
  });
}

async function handleAdminReload(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const channelId = process.env.CHANNEL_ID;
  if (!channelId) {
    return interaction.editReply({
      embeds: [createErrorEmbed('Config Error', 'CHANNEL_ID is not set in environment variables.')]
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
