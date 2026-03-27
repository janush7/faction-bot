const logger = require('../utils/logger');
const securityService = require('./securityService');
const { PermissionsBitField } = require('discord.js');

class RoleService {
  constructor(client) {
    this.client = client;
  }

  async assignFactionRole(member, faction) {
    // FEATURE 7: Validate input
    const factionValidation = securityService.validateFaction(faction);
    if (!factionValidation.valid) {
      logger.error(`Invalid faction attempt: ${factionValidation.error}`);
      securityService.logSecurityEvent('INVALID_FACTION', {
        userId: member.id,
        attemptedFaction: faction,
        reason: factionValidation.error
      });
      throw new Error(factionValidation.error);
    }

    // FEATURE 1: Check cooldown
    const cooldown = securityService.isFactionChangeCooldown(member.id);
    if (cooldown) {
      const error = `You must wait ${cooldown} second(s) before changing faction again`;
      logger.warn(`Faction cooldown triggered for ${member.user.tag}: ${error}`);
      throw new Error(error);
    }

    const roles = {
      allies: process.env.ALLIES_ROLE,
      axis: process.env.AXIS_ROLE
    };

    // FEATURE 7: Validate role IDs
    const alliesValidation = securityService.validateRoleId(roles.allies);
    const axisValidation = securityService.validateRoleId(roles.axis);

    if (!alliesValidation.valid || !axisValidation.valid) {
      logger.error('Invalid role IDs in environment');
      securityService.logSecurityEvent('INVALID_ROLE_ID', {
        alliesValid: alliesValidation.valid,
        axisValid: axisValidation.valid
      });
      throw new Error('Configuration error: Invalid role IDs');
    }

    // FEATURE 6: Validate bot has permission to manage roles
    const permissionCheck = await securityService.validateBotPermissions(
      member.guild,
      [PermissionsBitField.Flags.ManageRoles]
    );

    if (!permissionCheck.valid) {
      logger.error(`Bot permission missing: ${permissionCheck.error}`);
      securityService.logSecurityEvent('BOT_PERMISSION_MISSING', {
        error: permissionCheck.error,
        userId: member.id
      });
      throw new Error('Bot does not have permission to manage roles');
    }

    // FEATURE 6: Validate role exists and is manageable
    const roleValidation = await securityService.validateRolePermissions(
      member.guild,
      roles[faction]
    );

    if (!roleValidation.valid) {
      logger.error(`Role validation failed: ${roleValidation.error}`);
      securityService.logSecurityEvent('ROLE_VALIDATION_FAILED', {
        faction,
        error: roleValidation.error
      });
      throw new Error(roleValidation.error);
    }

    const opposite = faction === 'allies' ? 'axis' : 'allies';

    try {
      await member.roles.remove(roles[opposite]).catch(() => {});

      if (!member.roles.cache.has(roles[faction])) {
        await member.roles.add(roles[faction]);
      }

      logger.success(`${member.user.tag} assigned to ${faction.toUpperCase()}`);
      
      securityService.logSecurityEvent('FACTION_ASSIGNED', {
        userId: member.id,
        username: member.user.tag,
        faction: faction,
        timestamp: new Date().toISOString()
      });

      return { success: true, faction };
    } catch (error) {
      logger.error(`Failed to assign ${faction} role:`, error);
      securityService.logSecurityEvent('FACTION_ASSIGNMENT_FAILED', {
        userId: member.id,
        faction: faction,
        error: error.message
      });
      throw error;
    }
  }

  async resetAllFactions() {
    try {
      const guild = this.client.guilds.cache.get(process.env.MAIN_GUILD_ID);
      if (!guild) {
        throw new Error('Guild not found');
      }

      // FEATURE 6: Validate bot permissions
      const permissionCheck = await securityService.validateBotPermissions(
        guild,
        [PermissionsBitField.Flags.ManageRoles]
      );

      if (!permissionCheck.valid) {
        throw new Error(permissionCheck.error);
      }

      const alliesRole = guild.roles.cache.get(process.env.ALLIES_ROLE);
      const axisRole = guild.roles.cache.get(process.env.AXIS_ROLE);

      if (!alliesRole || !axisRole) {
        throw new Error('One or more roles not found');
      }

      let removed = { allies: 0, axis: 0 };

      for (const member of alliesRole.members.values()) {
        await member.roles.remove(process.env.ALLIES_ROLE).catch(() => {});
        removed.allies++;
      }

      for (const member of axisRole.members.values()) {
        await member.roles.remove(process.env.AXIS_ROLE).catch(() => {});
        removed.axis++;
      }

      logger.success(`Reset complete. Removed ${removed.allies} allies and ${removed.axis} axis members.`);
      
      securityService.logSecurityEvent('ROLES_RESET', {
        alliesRemoved: removed.allies,
        axisRemoved: removed.axis,
        timestamp: new Date().toISOString()
      });

      return removed;
    } catch (error) {
      logger.error('Error during role reset:', error);
      securityService.logSecurityEvent('ROLE_RESET_FAILED', {
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = RoleService;