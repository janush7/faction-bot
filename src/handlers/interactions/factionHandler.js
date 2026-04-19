/**
 * factionHandler.js — Handles faction button interactions.
 *
 * A user may only hold one faction role at a time across all servers (S1/S2).
 * Selecting a new faction removes any other faction role the user holds.
 */

const { EmbedBuilder } = require('discord.js');
const logger = require('../../utils/logger');
const { createErrorEmbed } = require('../../utils/embeds');
const { sendLog } = require('./shared');
const { getFaction, getFactionRoleId, getAllFactionRoleIds } = require('../../config/factions');

// Per-user cooldown (anti-spam) on actual faction swaps. Keyed by Discord
// user ID, value is the Unix-ms timestamp of the last successful swap.
// Resets on process restart — fine for this use case.
const lastSwapAtMs = new Map();

function cooldownSeconds() {
  const raw = parseInt(process.env.FACTION_SWAP_COOLDOWN_SECONDS ?? '20', 10);
  return Number.isFinite(raw) && raw >= 0 ? raw : 20;
}

async function handleFactionSelection(interaction, factionKey) {
  const faction = getFaction(factionKey);
  if (!faction) {
    return interaction.reply({
      embeds: [createErrorEmbed('Unknown Faction', `Unknown faction: \`${factionKey}\`.`)],
      flags: 64
    });
  }

  const selectedRoleId = getFactionRoleId(factionKey);
  if (!selectedRoleId) {
    return interaction.reply({
      embeds: [createErrorEmbed('Config Error', `Faction role is not configured. Ask an admin to set \`${faction.envVar}\`.`)],
      flags: 64
    });
  }

  const member = interaction.member;
  const factionLabel = `${faction.fallbackEmoji} ${faction.label}`;

  if (member.roles.cache.has(selectedRoleId)) {
    return interaction.reply({ content: `⚠️ You are already on **${factionLabel}**!`, flags: 64 });
  }

  // Anti-spam: enforce per-user cooldown between faction swaps.
  const cdSec = cooldownSeconds();
  if (cdSec > 0) {
    const last = lastSwapAtMs.get(interaction.user.id) ?? 0;
    const elapsedSec = Math.floor((Date.now() - last) / 1000);
    if (elapsedSec < cdSec) {
      const waitSec = cdSec - elapsedSec;
      return interaction.reply({
        content: `⏳ Slow down! You can swap factions again in **${waitSec}s**.`,
        flags: 64
      });
    }
  }

  // Remove any other faction role(s) the user currently holds — one faction
  // at a time across all servers.
  const otherFactionRoleIds = getAllFactionRoleIds().filter(id => id !== selectedRoleId);
  const rolesToRemove = otherFactionRoleIds.filter(id => member.roles.cache.has(id));
  let switched = false;
  if (rolesToRemove.length) {
    switched = true;
    await member.roles.remove(rolesToRemove, 'Switching faction').catch(e =>
      logger.warn(`Could not remove previous faction role(s) from ${interaction.user.tag}: ${e.message}`)
    );
  }

  await member.roles.add(selectedRoleId);
  lastSwapAtMs.set(interaction.user.id, Date.now());
  logger.info(`${interaction.user.tag} joined ${factionLabel}`);

  const logEmbed = new EmbedBuilder()
    .setColor(faction.color)
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
