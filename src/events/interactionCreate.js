/**
 * interactionCreate.js — Central router for all Discord interactions.
 *
 * Business logic lives in the handlers/interactions/ modules; this file is
 * purely responsible for dispatching to the right handler.
 */

const { PermissionFlagsBits } = require('discord.js');
const logger = require('../utils/logger');
const { createErrorEmbed } = require('../utils/embeds');

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
  handleAdminPostRotation,
  handleAdminEditRotation
} = require('../handlers/interactions/rotationHandler');
const {
  handleAdminResetConfirm,
  handleAdminResetCancel,
  handleAdminReset,
  handleAdminReload,
  handleAdminClearLogsConfirm,
  handleAdminClearLogsCancel,
  handleAdminClearLogs
} = require('../handlers/interactions/adminHandler');
const { buildPanelPayload } = require('../commands/admin/panel');

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
        if (interaction.customId.startsWith('lineup_caption:'))  return await handleLineupCaptionSubmit(interaction);
        if (interaction.customId.startsWith('lineup_server:'))   return await handleServerModalSubmit(interaction);
        if (interaction.customId === 'nodes_edit')               return await handleNodesModalSubmit(interaction);
        if (interaction.customId.startsWith('rotation_edit:'))   return await handleRotationModalSubmit(interaction);
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

          if (interaction.customId === 'admin_faction_select') {
            if (value === 'reload') return await handleAdminReload(interaction);
            if (value === 'reset')  return await handleAdminResetConfirm(interaction);
          }

          if (interaction.customId === 'admin_lineup_select') {
            const [action, server] = value.split(':');
            if (action === 'edit') return await handleAdminEditCaption(interaction, server);
          }

          if (interaction.customId === 'admin_server_select') {
            const [action, server] = value.split(':');
            if (action === 'post') return await handleAdminPostServer(interaction, server);
            if (action === 'edit') return await handleAdminEditServer(interaction, server);
          }

          if (interaction.customId === 'admin_rotnodes_select') {
            if (value === 'rotation:post') return await handleAdminPostRotation(interaction);
            if (value === 'rotation:edit') return await handleAdminEditRotation(interaction);
            if (value === 'nodes:post')    return await handleAdminPostNodes(interaction);
            if (value === 'nodes:edit')    return await handleAdminEditNodes(interaction);
          }

          if (interaction.customId === 'admin_panel_select') {
            if (value === 'refresh') {
              await interaction.deferUpdate();
              const payload = await buildPanelPayload(interaction.client);
              return await interaction.editReply(payload);
            }
            if (value === 'clearlogs') return await handleAdminClearLogsConfirm(interaction);
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
        if (customId === 'admin_reset_confirm')      return await handleAdminReset(interaction);
        if (customId === 'admin_reset_cancel')       return await handleAdminResetCancel(interaction);
        if (customId === 'admin_reload')             return await handleAdminReload(interaction);
        if (customId === 'admin_clearlogs')          return await handleAdminClearLogsConfirm(interaction);
        if (customId === 'admin_clearlogs_confirm')  return await handleAdminClearLogs(interaction);
        if (customId === 'admin_clearlogs_cancel')   return await handleAdminClearLogsCancel(interaction);
        if (customId === 'admin_refresh') {
          await interaction.deferUpdate();
          const payload = await buildPanelPayload(interaction.client);
          return await interaction.editReply(payload);
        }
        if (customId.startsWith('admin_post_server')) return await handleAdminPostServer(interaction);
        if (customId.startsWith('admin_edit_caption')) return await handleAdminEditCaption(interaction);
        if (customId.startsWith('admin_edit_server')) return await handleAdminEditServer(interaction);
        if (customId === 'admin_post_nodes')      return await handleAdminPostNodes(interaction);
        if (customId === 'admin_edit_nodes')      return await handleAdminEditNodes(interaction);
        if (customId === 'admin_post_rotation')   return await handleAdminPostRotation(interaction);
        if (customId === 'admin_edit_rotation')   return await handleAdminEditRotation(interaction);
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
