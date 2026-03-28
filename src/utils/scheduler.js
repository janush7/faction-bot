const cron = require('node-cron');
const { EmbedBuilder } = require('discord.js');
const logger = require('./logger');

/**
 * Starts the weekly faction role reset scheduler.
 * Default: every Wednesday at 22:00 Europe/Warsaw.
 * Configurable via RESET_DAY (0=Sun, 3=Wed) and RESET_HOUR in .env
 */
function startScheduler(client) {
  const day = process.env.RESET_DAY ?? '3';     // 3 = Wednesday
  const hour = process.env.RESET_HOUR ?? '22';  // 22:00

  const expression = `0 ${hour} * * ${day}`;

  if (!cron.validate(expression)) {
    logger.error(`Invalid cron expression: ${expression}. Scheduler not started.`);
    return;
  }

  cron.schedule(expression, () => resetFactionRoles(client), {
    timezone: 'Europe/Warsaw'
  });

  logger.info(`Scheduler started — auto-reset every day ${day} at ${hour}:00 Warsaw time`);
}

async function resetFactionRoles(client) {
  logger.info('Running scheduled faction role reset...');

  const guild = client.guilds.cache.get(process.env.GUILD_ID);
  if (!guild) {
    logger.error('Scheduler: guild not found.');
    return;
  }

  const alliesRole = guild.roles.cache.get(process.env.ALLIES_ROLE);
  const axisRole = guild.roles.cache.get(process.env.AXIS_ROLE);

  if (!alliesRole || !axisRole) {
    logger.error('Scheduler: faction roles not found. Check ALLIES_ROLE and AXIS_ROLE in .env');
    return;
  }

  let removed = 0;
  let failed = 0;

  try {
    await guild.members.fetch();
  } catch (err) {
    logger.error('Scheduler: failed to fetch members:', err);
    return;
  }

  for (const [, member] of guild.members.cache) {
    const hasAllies = member.roles.cache.has(alliesRole.id);
    const hasAxis = member.roles.cache.has(axisRole.id);
    if (!hasAllies && !hasAxis) continue;

    try {
      const rolesToRemove = [];
      if (hasAllies) rolesToRemove.push(alliesRole);
      if (hasAxis) rolesToRemove.push(axisRole);
      await member.roles.remove(rolesToRemove, 'Weekly faction reset');
      removed++;
    } catch (err) {
      logger.warn(`Scheduler: failed to remove roles from ${member.user.tag}: ${err.message}`);
      failed++;
    }
  }

  logger.success(`Scheduled reset done — removed roles from ${removed} member(s), ${failed} failed.`);

  // Log to admin channel
  if (process.env.ADMIN_LOG_CHANNEL) {
    try {
      const channel = await client.channels.fetch(process.env.ADMIN_LOG_CHANNEL);
      if (channel?.isTextBased()) {
        const embed = new EmbedBuilder()
          .setTitle('🔄 Weekly Faction Reset')
          .setColor(0x011327)
          .setDescription('Scheduled weekly role reset has been executed.')
          .addFields(
            { name: '✅ Roles Removed', value: `${removed} member(s)`, inline: true },
            { name: '❌ Failed', value: `${failed} member(s)`, inline: true }
          )
          .setTimestamp();
        await channel.send({ embeds: [embed] });
      }
    } catch (err) {
      logger.warn(`Scheduler: could not log to admin channel: ${err.message}`);
    }
  }
}

module.exports = { startScheduler, resetFactionRoles };
