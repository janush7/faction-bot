/**
 * interactionCreate.js — Central router for all Discord interactions.
 *
 * Business logic lives in the handlers/interactions/ modules; this file is
 * purely responsible for dispatching to the right handler.
 */

const { PermissionFlagsBits } = require('discord.js');
const logger = require('../utils/logger');
const { createErrorEmbed } = require('../utils/embeds');
const { saveLastAction }   = require('../utils/lastActionStore');

// ── Handler imports ───────────────────────────────────────────────────────────
const { handleFactionSelection }                         = require('../handlers/interactions/factionHandler');
const {
  handleLineupEditCapButton,
  handleLineupCaptionSubmit,
  handleLineupEditServerButton,
  handleServerModalSubmit,
  handleAdminPostServer,
  handleAdminEditCaption,
  handleAdminEditServer
} = require('../handlers/interactions/lineupHandler');
const { handleNodesModalSubmit, handleAdminPostNodes, handleAdminEditNodes } = require('../handlers/interactions/nodesHandler');
const {
  handleRotationModalSubmit,
  handleRotationApplyButton,
  handleRotationCancelButton,
  handleAdminPostRotation,
  handleAdminEditRotation,
  handleAdminAdvanceRotation
} = require('../handlers/interactions/rotationHandler');
const { handleAdminPostAllMissing } = require('../handlers/interactions/postAllHandler');
const {
  handleAdminResetConfirm,
  handleAdminResetCancel,
  handleAdminReset,
  handleAdminReload,
  handleAdminClearLogsConfirm,
  handleAdminClearLogsCancel,
  handleAdminClearLogs,
  handleAdminHealthcheck
} = require('../handlers/interactions/adminHandler');
const { buildPanelPayload, refreshPanelMessage } = require('../commands/admin/panel');

// ── Helpers ──────────────────────────────────────────────────────────────────
// Runs the underlying handler, records the admin action in the lastAction
// store, and (optionally) edits the panel message in place so 🔴/🟢 status
// and dropdown placeholders update without a manual refresh click.

async function trackAction(interaction, label, fn, { refresh = true } = {}) {
  await fn();
  saveLastAction(label, interaction.user.id, interaction.user.tag);
  if (refresh) await refreshPanelMessage(interaction);
}

// ── Main handler ──────────────────────────────────────────────────────────────

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
        const reply = { content: '❌ An error occurred.', flags: 64 };
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
        if (interaction.customId.startsWith('lineup_caption:')) {
          // customId: lineup_caption:CHANNEL_ID:MESSAGE_ID[:SERVER]
          const server = interaction.customId.split(':')[3] || null;
          return await trackAction(
            interaction,
            server ? `Edit Lineup — ${server}` : 'Edit Lineup',
            () => handleLineupCaptionSubmit(interaction)
          );
        }
        if (interaction.customId.startsWith('lineup_server:')) {
          // customId: lineup_server:CHANNEL_ID:MESSAGE_ID[:SERVER]
          const server = interaction.customId.split(':')[3] || null;
          return await trackAction(
            interaction,
            server ? `Edit Server Details — ${server}` : 'Edit Server Details',
            () => handleServerModalSubmit(interaction)
          );
        }
        if (interaction.customId === 'nodes_edit') {
          return await trackAction(
            interaction,
            'Edit Nodes',
            () => handleNodesModalSubmit(interaction)
          );
        }
        if (interaction.customId.startsWith('rotation_edit:')) {
          // Modal submit now shows a preview instead of saving directly;
          // the lastAction entry is written when the admin clicks Apply.
          return await handleRotationModalSubmit(interaction);
        }
      } catch (error) {
        logger.error('Error handling modal submit:', error);
        const reply = { content: '❌ An error occurred.', flags: 64 };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(reply).catch(() => {});
        } else {
          await interaction.reply(reply).catch(() => {});
        }
      }
      return;
    }

    // ── String Select Menus ────────────────────────────────────────────────
    if (interaction.isStringSelectMenu()) {
      try {
        if (interaction.customId.startsWith('admin_')) {
          if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({
              embeds: [createErrorEmbed('Permission Denied', 'Only administrators can use these controls.')],
              flags: 64
            });
          }
          const value = interaction.values[0] || '';

          // Wrap every admin-select dispatch in a try/finally that rebuilds
          // the panel so the dropdown returns to its placeholder instead of
          // showing the last selected option ("✏️ Edit Nodes", etc.). The
          // refresh is fire-and-forget and never blocks the handler's
          // own response.
          try {
            if (interaction.customId === 'admin_faction_select') {
              if (value === 'reload') {
                return await trackAction(
                  interaction,
                  'Reload Faction Embed',
                  () => handleAdminReload(interaction),
                  { refresh: false }
                );
              }
              // Reset only opens the confirm dialog — recorded when user confirms.
              if (value === 'reset') return await handleAdminResetConfirm(interaction);
            }

            if (interaction.customId === 'admin_lineup_select') {
              const [action, server] = value.split(':');
              // Edit only opens a modal — recorded on modal submit.
              if (action === 'edit') return await handleAdminEditCaption(interaction, server);
            }

            if (interaction.customId === 'admin_server_select') {
              const [action, server] = value.split(':');
              if (action === 'post') {
                return await trackAction(
                  interaction,
                  server ? `Post Server Details — ${server}` : 'Post Server Details',
                  () => handleAdminPostServer(interaction, server),
                  { refresh: false }
                );
              }
              if (action === 'edit') return await handleAdminEditServer(interaction, server);
            }

            if (interaction.customId === 'admin_rotnodes_select') {
              if (value === 'rotation:post') {
                return await trackAction(
                  interaction,
                  'Post Map Rotation',
                  () => handleAdminPostRotation(interaction),
                  { refresh: false }
                );
              }
              if (value === 'rotation:edit') return await handleAdminEditRotation(interaction);
              if (value === 'rotation:advance') {
                return await trackAction(
                  interaction,
                  'Advance Rotation',
                  () => handleAdminAdvanceRotation(interaction),
                  { refresh: false }
                );
              }
              if (value === 'nodes:post') {
                return await trackAction(
                  interaction,
                  'Post Nodes',
                  () => handleAdminPostNodes(interaction),
                  { refresh: false }
                );
              }
              if (value === 'nodes:edit')    return await handleAdminEditNodes(interaction);
            }

            if (interaction.customId === 'admin_panel_select') {
              if (value === 'refresh') {
                // Just ack the interaction; the finally below redraws the panel.
                return await interaction.deferUpdate();
              }
              if (value === 'postall') {
                return await trackAction(
                  interaction,
                  'Post All Missing',
                  () => handleAdminPostAllMissing(interaction),
                  { refresh: false }
                );
              }
              if (value === 'healthcheck') {
                return await handleAdminHealthcheck(interaction);
              }
              // Clear logs only opens confirm — recorded when user confirms.
              if (value === 'clearlogs') return await handleAdminClearLogsConfirm(interaction);
            }
          } finally {
            refreshPanelMessage(interaction).catch(() => {});
          }
        }
      } catch (error) {
        logger.error('Error handling select menu:', error);
        const reply = { content: '❌ An error occurred.', flags: 64 };
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
      // ── Lineup / Server buttons ───────────────────────────────────────────
      if (customId.startsWith('lineup_editcap:'))    return await handleLineupEditCapButton(interaction);
      if (customId.startsWith('lineup_editserver:')) return await handleLineupEditServerButton(interaction);

      // ── Faction buttons ───────────────────────────────────────────────────
      if (customId.startsWith('faction_')) {
        const factionKey = customId.slice('faction_'.length);
        return await handleFactionSelection(interaction, factionKey);
      }

      // ── Admin buttons ─────────────────────────────────────────────────────
      if (customId.startsWith('admin_')) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
          return interaction.reply({
            embeds: [createErrorEmbed('Permission Denied', 'Only administrators can use these controls.')],
            flags: 64
          });
        }

        if (customId === 'admin_reset')              return await handleAdminResetConfirm(interaction);
        if (customId === 'admin_reset_confirm') {
          // Confirmed from an ephemeral dialog; interaction.message is the
          // dialog, not the panel, so we skip the auto-refresh here.
          return await trackAction(
            interaction,
            'Reset Roles',
            () => handleAdminReset(interaction),
            { refresh: false }
          );
        }
        if (customId === 'admin_reset_cancel')       return await handleAdminResetCancel(interaction);
        if (customId === 'admin_reload') {
          return await trackAction(
            interaction,
            'Reload Faction Embed',
            () => handleAdminReload(interaction)
          );
        }
        if (customId === 'admin_clearlogs')          return await handleAdminClearLogsConfirm(interaction);
        if (customId === 'admin_clearlogs_confirm') {
          return await trackAction(
            interaction,
            'Clear Log Channel',
            () => handleAdminClearLogs(interaction),
            { refresh: false }
          );
        }
        if (customId === 'admin_clearlogs_cancel')   return await handleAdminClearLogsCancel(interaction);
        if (customId === 'admin_refresh') {
          await interaction.deferUpdate();
          const payload = await buildPanelPayload(interaction.client, interaction.guildId);
          return await interaction.editReply(payload);
        }
        if (customId.startsWith('admin_post_server')) {
          return await trackAction(
            interaction,
            'Post Server Details',
            () => handleAdminPostServer(interaction)
          );
        }
        if (customId.startsWith('admin_edit_caption')) return await handleAdminEditCaption(interaction);
        if (customId.startsWith('admin_edit_server')) return await handleAdminEditServer(interaction);
        if (customId === 'admin_post_nodes') {
          return await trackAction(
            interaction,
            'Post Nodes',
            () => handleAdminPostNodes(interaction)
          );
        }
        if (customId === 'admin_edit_nodes')      return await handleAdminEditNodes(interaction);
        if (customId === 'admin_post_rotation') {
          return await trackAction(
            interaction,
            'Post Map Rotation',
            () => handleAdminPostRotation(interaction)
          );
        }
        if (customId === 'admin_edit_rotation')   return await handleAdminEditRotation(interaction);
      }

      // ── Rotation preview Apply / Cancel (own namespace) ───────────────────
      if (customId.startsWith('rotation_apply:')) {
        return await trackAction(
          interaction,
          'Edit Map Rotation',
          () => handleRotationApplyButton(interaction),
          { refresh: false }
        );
      }
      if (customId.startsWith('rotation_cancel:')) {
        return await handleRotationCancelButton(interaction);
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
