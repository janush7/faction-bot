/**
 * factionHandler.js — Handles Allies / Axis faction button interactions.
 */

const { EmbedBuilder } = require('discord.js');
const logger = require('../../utils/logger');
const { createErrorEmbed } = require('../../utils/embeds');
const { sendLog } = require('./shared');

async function handleFactionSelection(interaction, faction) {
  const alliesRoleId = process.env.ALLIES_ROLE;
  const axisRoleId   = process.env.AXIS_ROLE;
  const member       = interaction.member;

  const selectedRoleId = faction === 'allies' ? alliesRoleId : axisRoleId;
  const oppositeRoleId = faction === 'allies' ? axisRoleId   : alliesRoleId;
  const factionLabel   = faction === 'allies' ? '🔵 Allies'  : '🔴 Axis';
  const factionColor   = faction === 'allies' ? 0x3b82f6     : 0xef4444;

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
      { name: '👤 User',      value: `<@${interaction.user.id}>`, inline: true },
      { name: '🏳️ Faction',  value: factionLabel,                inline: true },
      { name: '🔄 Switched',  value: switched ? 'Yes' : 'No',    inline: true }
    )
    .setTimestamp();

  await sendLog(interaction.client, logEmbed);

  return interaction.reply({
    content: `✅ You have joined **${factionLabel}**! Good luck on the battlefield!`,
    flags: 64
  });
}

module.exports = { handleFactionSelection };
