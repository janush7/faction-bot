/**
 * adminHandler.js — Handles admin panel button interactions.
 */

const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const logger = require('../../utils/logger');
const { createFactionEmbed, createSuccessEmbed, createErrorEmbed } = require('../../utils/embeds');
const { createFactionButtons } = require('../../utils/buttons');
const { sendLog, bulkDeleteFiltered, batchRoleRemove } = require('./shared');
const { getAllFactionRoleIds } = require('../../config/factions');
const { runHealthcheck } = require('../../utils/healthcheck');
const { remainingCooldown, markAdminAction } = require('../../utils/adminCooldown');

/**
 * Enforces a short per-user cooldown on destructive admin actions so an
 * accidental double-click on Confirm cannot trigger the work twice. Returns
 * `true` if the action may proceed (and records the timestamp), or replies
 * ephemerally and returns `false` when the user is still cooling down.
 */
async function _enforceAdminCooldown(interaction, action) {
  const remaining = remainingCooldown(interaction.user.id, action);
  if (remaining > 0) {
    await interaction.reply({
      embeds: [createErrorEmbed('Slow down', `Please wait **${remaining}s** before repeating *${action}*.`)],
      flags: 64,
    });
    return false;
  }
  markAdminAction(interaction.user.id, action);
  return true;
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

/**
 * Removes faction roles from all members in batches to respect Discord rate limits.
 */
async function handleAdminReset(interaction) {
  if (!(await _enforceAdminCooldown(interaction, 'Reset Roles'))) return;

  await interaction.update({
    embeds: [new EmbedBuilder().setColor(0x011327).setDescription('⏳ Resetting faction roles...')],
    components: []
  });

  const factionRoleIds = getAllFactionRoleIds();
  const guild          = interaction.guild;

  let totalCount  = 0;
  let totalErrors = [];

  await guild.members.fetch();

  for (const roleId of factionRoleIds) {
    const role = guild.roles.cache.get(roleId);
    if (!role) continue;
    const membersWithRole = [...role.members.values()];
    if (!membersWithRole.length) continue;

    // Use batched removal (5 at a time, 500ms between batches) instead of
    // firing all requests concurrently which hammers Discord's rate limiter.
    const { count, errors } = await batchRoleRemove(membersWithRole, roleId);
    totalCount  += count;
    totalErrors  = totalErrors.concat(errors);
  }

  logger.info(`${interaction.user.tag} reset faction roles — ${totalCount} removal(s), ${totalErrors.length} error(s)`);

  const logEmbed = new EmbedBuilder()
    .setColor(0x011327)
    .setTitle('🔁 Manual Faction Reset')
    .addFields(
      { name: '👤 Admin',         value: `<@${interaction.user.id}>`, inline: true },
      { name: '✅ Roles Removed', value: `${totalCount}`,             inline: true },
      { name: '❌ Errors',        value: `${totalErrors.length}`,     inline: true }
    )
    .setTimestamp();

  await sendLog(interaction.client, logEmbed);

  return interaction.editReply({
    embeds: [createSuccessEmbed('Roles Reset', `Removed **${totalCount}** faction role(s).${totalErrors.length ? `\n⚠️ ${totalErrors.length} error(s) occurred.` : ''}`)],
    components: []
  });
}

// ── Admin: Reload Faction Embed ───────────────────────────────────────────────

/**
 * Deletes ONLY the faction embed (title === 'Choose your side!') from the
 * faction channel, then re-posts a fresh one.
 *
 * Previously this deleted ALL bot embeds in the channel, which could wipe
 * unrelated embeds (server details, lineup, etc.) by mistake.
 */
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

  // Only remove the faction embed — leave all other bot messages untouched.
  const deleted = await bulkDeleteFiltered(
    channel,
    msg =>
      msg.author.id === interaction.client.user.id &&
      msg.embeds.some(e => e.title === 'Choose your side!')
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
    embeds: [createSuccessEmbed('Embed Reloaded', `Cleared **${deleted}** faction embed(s) and posted a fresh one in <#${channelId}>.`)]
  });
}

// ── Admin: Clear Logs (confirmation flow) ─────────────────────────────────────

async function handleAdminClearLogsConfirm(interaction) {
  const logChannelId = process.env.ADMIN_LOG_CHANNEL;
  const target       = logChannelId ? `<#${logChannelId}>` : 'the log channel';

  const confirmEmbed = new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle('⚠️ Confirm Log Clear')
    .setDescription(`This will delete **all messages** in ${target}.\n\nAre you sure?`);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('admin_clearlogs_confirm')
      .setLabel('Confirm')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('admin_clearlogs_cancel')
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary)
  );

  return interaction.reply({ embeds: [confirmEmbed], components: [row], flags: 64 });
}

async function handleAdminClearLogsCancel(interaction) {
  return interaction.update({
    embeds: [createErrorEmbed('Cancelled', 'Log clear was cancelled.')],
    components: []
  });
}

async function handleAdminClearLogs(interaction) {
  if (!(await _enforceAdminCooldown(interaction, 'Clear Log Channel'))) return;

  await interaction.update({
    embeds: [new EmbedBuilder().setColor(0x011327).setDescription('⏳ Clearing logs...')],
    components: []
  });

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

// ── Admin: Healthcheck ────────────────────────────────────────────────────────

async function handleAdminHealthcheck(interaction) {
  // Ack the select-menu interaction with deferUpdate so the panel stays
  // in place and the shared finally-block in interactionCreate.js can
  // reset the dropdown placeholder via refreshPanelMessage().
  await interaction.deferUpdate();

  const guildId = process.env.GUILD_ID;
  const { passed, total, issues } = await runHealthcheck(interaction.client, guildId);

  const allGood = issues.length === 0;
  const color   = allGood ? 0x2ecc71 : 0xe67e22;
  const title   = allGood
    ? `✅ Healthcheck — ${passed}/${total} checks passed`
    : `⚠️ Healthcheck — ${passed}/${total} checks passed`;

  const description = allGood
    ? 'All systems nominal.'
    : issues.slice(0, 20)
        .map(i => `• **${i.label}** — ${i.detail}`)
        .join('\n') + (issues.length > 20 ? `\n…and ${issues.length - 20} more.` : '');

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description || '—')
    .setTimestamp();

  logger.info(`${interaction.user.tag} ran healthcheck — ${passed}/${total} passed, ${issues.length} issue(s)`);

  return interaction.followUp({ embeds: [embed], flags: 64 });
}

module.exports = {
  handleAdminResetConfirm,
  handleAdminResetCancel,
  handleAdminReset,
  handleAdminReload,
  handleAdminClearLogsConfirm,
  handleAdminClearLogsCancel,
  handleAdminClearLogs,
  handleAdminHealthcheck
};
