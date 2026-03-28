const logger = require('../utils/logger');

class SecurityService {
  constructor() {
    this.commandCooldowns = new Map();
    this.factionChangeCooldowns = new Map();
    this.COMMAND_COOLDOWN = 5000; // 5 seconds
    this.FACTION_COOLDOWN = 10000; // 10 seconds
  }

  // ===== FEATURE 1: COMMAND COOLDOWN =====
  isCommandOnCooldown(userId, commandName) {
    const key = `${userId}_${commandName}`;
    
    if (!this.commandCooldowns.has(key)) {
      this.commandCooldowns.set(key, Date.now());
      return false;
    }

    const lastUsed = this.commandCooldowns.get(key);
    const timePassed = Date.now() - lastUsed;

    if (timePassed < this.COMMAND_COOLDOWN) {
      const remaining = Math.ceil((this.COMMAND_COOLDOWN - timePassed) / 1000);
      return remaining;
    }

    this.commandCooldowns.set(key, Date.now());
    return false;
  }

  isFactionChangeCooldown(userId) {
    if (!this.factionChangeCooldowns.has(userId)) {
      this.factionChangeCooldowns.set(userId, Date.now());
      return false;
    }

    const lastChanged = this.factionChangeCooldowns.get(userId);
    const timePassed = Date.now() - lastChanged;

    if (timePassed < this.FACTION_COOLDOWN) {
      const remaining = Math.ceil((this.FACTION_COOLDOWN - timePassed) / 1000);
      return remaining; // returns seconds
    }

    this.factionChangeCooldowns.set(userId, Date.now());
    return false;
  }

  // ===== FEATURE 7: INPUT VALIDATION =====
  validateFaction(faction) {
    const validFactions = ['allies', 'axis'];
    
    if (!faction || typeof faction !== 'string') {
      return { valid: false, error: 'Invalid faction type' };
    }

    if (!validFactions.includes(faction.toLowerCase())) {
      return { valid: false, error: 'Faction must be "allies" or "axis"' };
    }

    return { valid: true };
  }

  validateUserId(userId) {
    if (!userId || typeof userId !== 'string') {
      return { valid: false, error: 'Invalid user ID' };
    }

    if (!/^\d+$/.test(userId)) {
      return { valid: false, error: 'User ID must contain only numbers' };
    }

    return { valid: true };
  }

  validateRoleId(roleId) {
    if (!roleId || typeof roleId !== 'string') {
      return { valid: false, error: 'Invalid role ID' };
    }

    if (!/^\d+$/.test(roleId)) {
      return { valid: false, error: 'Role ID must contain only numbers' };
    }

    return { valid: true };
  }

  // ===== FEATURE 6: PERMISSION VALIDATION =====
  async validateBotPermissions(guild, requiredPermissions) {
    try {
      const botMember = await guild.members.fetchMe();
      
      for (const permission of requiredPermissions) {
        if (!botMember.permissions.has(permission)) {
          return {
            valid: false,
            error: `Bot missing permission: ${permission}`
          };
        }
      }

      return { valid: true };
    } catch (error) {
      logger.error('Permission validation error:', error);
      return { valid: false, error: 'Failed to validate permissions' };
    }
  }

  async validateRolePermissions(guild, roleId) {
    try {
      const role = guild.roles.cache.get(roleId);
      
      if (!role) {
        return { valid: false, error: 'Role not found' };
      }

      if (role.managed) {
        return { valid: false, error: 'Cannot manage managed roles' };
      }

      return { valid: true, role };
    } catch (error) {
      logger.error('Role validation error:', error);
      return { valid: false, error: 'Failed to validate role' };
    }
  }

  async validateMemberPermissions(member, requiredPermissions) {
    try {
      for (const permission of requiredPermissions) {
        if (!member.permissions.has(permission)) {
          return {
            valid: false,
            error: `Missing permission: ${permission}`
          };
        }
      }

      return { valid: true };
    } catch (error) {
      logger.error('Member permission validation error:', error);
      return { valid: false, error: 'Failed to validate member permissions' };
    }
  }

  // ===== LOGGING SECURITY EVENTS =====
  logSecurityEvent(event, details) {
    const timestamp = new Date().toISOString();
    const message = `[SECURITY] ${timestamp} - ${event}: ${JSON.stringify(details)}`;
    logger.warn(message);
  }
}

module.exports = new SecurityService();
