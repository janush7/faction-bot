const { PermissionFlagsBits, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const logger = require('../utils/logger');
const { createFactionEmbed, createSuccessEmbed, createErrorEmbed } = require('../utils/embeds');
const { createFactionButtons } = require('../utils/buttons');
const { getTimes, saveTimes } = require('../utils/timesConfig');

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
      try {
        if (interaction.customId === 'lineup_times_modal') {
          return await handleTimesModal(interaction);
        }
      } catch (error) {
        logger.error('Error handling modal submit:', error);
        const reply = { content: '❌ An error occurred while saving times.', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(reply).catch(() => {});
        } else {
          await interaction.reply(reply).catch(() => {});
        }
      }
      return;
    }

    if (!interaction.isButton()) return;

    const { customId } = interaction;

    try {
      // ── Faction Buttons ───────────────────────────────────────────────────
      if (customId === 'faction_allies' || customId === 'faction_axis') {
        const faction = customId === 'faction_allies' ? 'allies' : 'axis';
        return await handleFactionSelection(interaction, faction);
      }

      // ── Lineup Edit Times Button ──────────────────────────────────────────
      if (customId === 'lineup_edittimes') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
          return interaction.reply({ content: '❌ Administrators only.', ephemeral: true });
        }
        return await handleEditTimesButton(interaction);
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

async function handleEditTimesButton(interaction) {
  const current = getTimes();

  const modal = new ModalBuilder()
    .setCustomId('lineup_times_modal')
    .setTitle('⚙️ Edit Event Times (Warsaw)');

  const matchInput = new TextInputBuilder()
    .setCustomId('time_match')
    .setLabel('Match Positions (HH:MM)')
    .setStyle(TextInputStyle.Short)
    .setValue(current.matchPositions)
    .setPlaceholder('e.g. 19:30')
    .setRequired(true);

  const slInput = new TextInputBuilder()
    .setCustomId('time_sl')
    .setLabel('SL Briefing (HH:MM)')
    .setStyle(TextInputStyle.Short)
    .setValue(current.slBriefing)
    .setPlaceholder('e.g. 19:30')
    .setRequired(true);

  const startInput = new TextInputBuilder()
    .setCustomId('time_start')
    .setLabel('Game Start (HH:MM)')
    .setStyle(TextInputStyle.Short)
    .setValue(current.gameStart)
    .setPlaceholder('e.g. 20:00')
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(matchInput),
    new ActionRowBuilder().addComponents(slInput),
    new ActionRowBuilder().addComponents(startInput),
  );

  await interaction.showModal(modal);
}

async function handleTimesModal(interaction) {
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

  const match = interaction.fields.getTextInputValue('time_match').trim();
  const sl    = interaction.fields.getTextInputValue('time_sl').trim();
  const start = interaction.fields.getTextInputValue('time_start').trim();

  if (!timeRegex.test(match) || !timeRegex.test(sl) || !timeRegex.test(start)) {
    return interaction.reply({
      content: '❌ Invalid time format. Use HH:MM (e.g. `19:30`).',
      ephemeral: true,
    });
  }

  saveTimes({ matchPositions: match, slBriefing: sl, gameStart: start });

  logger.info(`Event times updated by ${interaction.user.tag}: Match=${match} SL=${sl} Start=${start}`);

  return interaction.reply({
    content: `✅ Times updated!\n\n**Match Positions:** \`${match}\` · **SL Briefing:** \`${sl}\` · **Game Start:** \`${start}\`\n\nThese will apply to the next \`/lineup\`.`,
    ephemeral: true,
  });
}

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
