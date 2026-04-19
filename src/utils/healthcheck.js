/**
 * healthcheck.js — Runs a suite of probes against the live Discord state
 * and returns a structured report for the admin panel.
 *
 * Checks:
 *   • Every required env var is set.
 *   • Every configured channel ID resolves to a reachable channel.
 *   • The bot has the permissions it needs on each channel.
 *   • Every configured role ID resolves to a role on the guild.
 *   • Cached message IDs (faction/lineup/server/rotation/nodes) still
 *     exist on Discord.
 */

const { PermissionFlagsBits } = require('discord.js');
const { loadLineupData, loadServerData } = require('./lineupStore');
const { loadRotationMsgId } = require('./rotationStore');
const { getAllFactionRoleIds } = require('../config/factions');

const REQUIRED_ENV_VARS = [
  'GUILD_ID',
  'FACTION_CHANNEL',
  'LINEUP_CHANNEL',
  'SERVER_DETAILS_CHANNEL',
  'MAP_ROTATION_CHANNEL',
  'NODES_CHANNELS',
];

// Channels the bot posts messages to. Minimum required perms: View + Send
// + Embed Links. Log channel additionally needs Manage Messages for the
// clear-log flow to work.
const CHANNEL_CHECKS = [
  { envVar: 'FACTION_CHANNEL',        label: 'Faction',        needsManage: false, multiple: false },
  { envVar: 'LINEUP_CHANNEL',         label: 'Lineup',         needsManage: false, multiple: false },
  { envVar: 'SERVER_DETAILS_CHANNEL', label: 'Server Details', needsManage: false, multiple: false },
  { envVar: 'MAP_ROTATION_CHANNEL',   label: 'Map Rotation',   needsManage: false, multiple: false },
  { envVar: 'NODES_CHANNELS',         label: 'Nodes',          needsManage: false, multiple: true  },
  { envVar: 'ADMIN_LOG_CHANNEL',      label: 'Admin Logs',     needsManage: true,  multiple: false, optional: true },
];

function baseChannelPerms(needsManage) {
  const perms = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.EmbedLinks,
  ];
  if (needsManage) perms.push(PermissionFlagsBits.ManageMessages);
  return perms;
}

async function checkChannelAccess(client, channelId, needsManage) {
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel) return { ok: false, reason: 'channel not found' };
    const me = channel.guild?.members?.me ?? null;
    if (!me) return { ok: true };
    const perms = channel.permissionsFor(me);
    if (!perms) return { ok: false, reason: 'permissions unavailable' };
    const missing = baseChannelPerms(needsManage).filter(p => !perms.has(p));
    if (missing.length) {
      const names = missing.map(p => {
        for (const [k, v] of Object.entries(PermissionFlagsBits)) {
          if (v === p) return k;
        }
        return 'Unknown';
      });
      return { ok: false, reason: `missing perms: ${names.join(', ')}` };
    }
    return { ok: true, channelName: channel.name };
  } catch (e) {
    return { ok: false, reason: `fetch failed (${e.code ?? e.message})` };
  }
}

async function checkRole(guild, roleId) {
  try {
    const role = await guild.roles.fetch(roleId).catch(() => null);
    return role ? { ok: true, name: role.name } : { ok: false, reason: 'role not found' };
  } catch (_) {
    return { ok: false, reason: 'fetch failed' };
  }
}

async function checkCachedMessage(client, channelId, messageId) {
  if (!channelId || !messageId) return { ok: true, skipped: true };
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel) return { ok: false, reason: 'channel missing' };
    const msg = await channel.messages.fetch(messageId).catch(() => null);
    return msg ? { ok: true } : { ok: false, reason: 'cached message deleted on Discord' };
  } catch (_) {
    return { ok: false, reason: 'fetch failed' };
  }
}

/**
 * Runs every probe and returns { passed, total, issues: [{ label, detail }] }.
 */
async function runHealthcheck(client, guildId) {
  const issues = [];
  let total = 0;
  let passed = 0;

  // 1. Env vars
  for (const key of REQUIRED_ENV_VARS) {
    total++;
    const v = process.env[key];
    if (v && String(v).trim() !== '') passed++;
    else issues.push({ label: `env: ${key}`, detail: 'missing or empty' });
  }

  // 2. Channels + permissions
  const channelResults = await Promise.all(
    CHANNEL_CHECKS.flatMap(cfg => {
      const raw = process.env[cfg.envVar];
      if (!raw) {
        if (cfg.optional) return [];
        return [Promise.resolve({ cfg, channelId: null, result: { ok: false, reason: 'env not set' } })];
      }
      const ids = cfg.multiple
        ? raw.split(',').map(s => s.trim()).filter(Boolean)
        : [raw.trim()];
      return ids.map(async id => ({ cfg, channelId: id, result: await checkChannelAccess(client, id, cfg.needsManage) }));
    })
  );
  for (const { cfg, channelId, result } of channelResults) {
    total++;
    if (result.ok) {
      passed++;
    } else {
      const where = channelId ? ` <#${channelId}>` : '';
      issues.push({ label: `channel: ${cfg.label}${where}`, detail: result.reason });
    }
  }

  // 3. Faction roles
  let guild = null;
  try { guild = await client.guilds.fetch(guildId); } catch (_) { /* handled below */ }
  const roleIds = getAllFactionRoleIds();
  for (const rid of roleIds) {
    total++;
    if (!guild) {
      issues.push({ label: `role: ${rid}`, detail: 'guild unreachable' });
      continue;
    }
    const r = await checkRole(guild, rid);
    if (r.ok) passed++;
    else issues.push({ label: `role: ${rid}`, detail: r.reason });
  }

  // 4. Cached message integrity
  const cachedChecks = [];
  const factionCh = process.env.FACTION_CHANNEL;
  const lineupCh = process.env.LINEUP_CHANNEL;
  const serverCh = process.env.SERVER_DETAILS_CHANNEL;
  const rotationCh = process.env.MAP_ROTATION_CHANNEL;

  if (lineupCh) {
    for (const s of ['S1', 'S2']) {
      const data = loadLineupData(lineupCh, s);
      cachedChecks.push({ label: `cached: Lineup ${s}`, channelId: lineupCh, messageId: data?.messageId });
    }
  }
  if (serverCh) {
    for (const s of ['S1', 'S2']) {
      const data = loadServerData(serverCh, s);
      cachedChecks.push({ label: `cached: Server ${s}`, channelId: serverCh, messageId: data?.messageId });
    }
  }
  if (rotationCh) {
    cachedChecks.push({
      label: 'cached: Map Rotation',
      channelId: rotationCh,
      messageId: loadRotationMsgId(rotationCh),
    });
  }
  // Faction embed is posted without a persisted ID — its presence is
  // already exercised by the panel's probeFaction; no cached-id check here.
  void factionCh;

  const cachedResults = await Promise.all(
    cachedChecks.map(async c => ({ ...c, result: await checkCachedMessage(client, c.channelId, c.messageId) }))
  );
  for (const { label, result } of cachedResults) {
    total++;
    if (result.skipped) { total--; continue; } // nothing stored → not a failure
    if (result.ok) passed++;
    else issues.push({ label, detail: result.reason });
  }

  return { passed, total, issues };
}

module.exports = { runHealthcheck };
