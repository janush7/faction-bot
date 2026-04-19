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
  handleAdminClearLogs
} = require('../handlers/interactions/adminHandler');

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

        if (customId === 'admin_reset')           return await handleAdminResetConfirm(interaction);
        if (customId === 'admin_reset_confirm')   return await handleAdminReset(interaction);
        if (customId === 'admin_reset_cancel')    return await handleAdminResetCancel(interaction);
        if (customId === 'admin_reload')          return await handleAdminReload(interaction);
        if (customId === 'admin_clearlogs')       return await handleAdminClearLogs(interaction);
        if (customId === 'admin_post_server')     return await handleAdminPostServer(interaction);
        if (customId.startsWith('admin_edit_caption')) return await handleAdminEditCaption(interaction);
        if (customId === 'admin_edit_server')     return await handleAdminEditServer(interaction);
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
