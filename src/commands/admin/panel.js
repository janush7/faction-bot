const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  EmbedBuilder
} = require('discord.js');

const { loadLineupData, loadServerData } = require('../../utils/lineupStore');
const { loadRotationMsgId }              = require('../../utils/rotationStore');
const { loadLastAction }                 = require('../../utils/lastActionStore');
const pkg = require('../../../package.json');

const OK = '🟢';
const NO = '🔴';
const PARTIAL = '🟡';
const BOT_STARTED_AT_MS = Date.now();

function humanizeAgo(ms) {
  const s = Math.floor(ms / 1000);
  if (s < 60)    return `${s}s ago`;
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function jumpUrl(guildId, channelId, messageId) {
  if (!guildId || !channelId || !messageId) return null;
  return `https://discord.com/channels/${guildId}/${channelId}/${messageId}`;
}

function jumpSuffix(guildId, channelId, messageId) {
  const url = jumpUrl(guildId, channelId, messageId);
  return url ? `  [↗️](${url})` : '';
}

// ── Status probes ────────────────────────────────────────────────────────────
// Each probe verifies state against Discord and returns either null (not
// posted) or a small locator object. Probes catch their own errors and
// degrade to null so the panel never throws.

async function messageLocator(client, channelId, messageId) {
  if (!channelId || !messageId) return null;
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel) return null;
    const msg = await channel.messages.fetch(messageId);
    return msg ? { channelId, messageId: msg.id } : null;
  } catch (_) {
    return null;
  }
}

async function probeFaction(client) {
  const ch = process.env.FACTION_CHANNEL;
  if (!ch) return null;
  try {
    const channel = await client.channels.fetch(ch);
    if (!channel) return null;
    const msgs = await channel.messages.fetch({ limit: 50 });
    const match = msgs.find(m =>
      m.author.id === client.user.id &&
      m.embeds.some(e => e.title === 'Choose your side!')
    );
    return match ? { channelId: ch, messageId: match.id } : null;
  } catch (_) {
    return null;
  }
}

async function probeLineup(client, server) {
  const ch = process.env.LINEUP_CHANNEL;
  if (!ch) return null;
  const data = loadLineupData(ch, server);
  return messageLocator(client, ch, data?.messageId);
}

async function probeServer(client, server) {
  const ch = process.env.SERVER_DETAILS_CHANNEL;
  if (!ch) return null;
  const data = loadServerData(ch, server);
  return messageLocator(client, ch, data?.messageId);
}

async function probeRotation(client) {
  const ch = process.env.MAP_ROTATION_CHANNEL;
  if (!ch) return null;
  return messageLocator(client, ch, loadRotationMsgId(ch));
}

async function probeNodes(client) {
  const channels = (process.env.NODES_CHANNELS || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  if (!channels.length) return { total: 0, hits: [] };

  const hits = await Promise.all(channels.map(async cid => {
    try {
      const ch = await client.channels.fetch(cid);
      if (!ch) return null;
      const msgs = await ch.messages.fetch({ limit: 50 });
      const match = msgs.find(m =>
        m.author.id === client.user.id &&
        m.embeds.some(e => e.title === 'NODES')
      );
      return match ? { channelId: cid, messageId: match.id } : null;
    } catch (_) {
      return null;
    }
  }));

  return { total: channels.length, hits: hits.filter(Boolean) };
}

// ── Description rows ─────────────────────────────────────────────────────────

function factionRow(locator, guildId) {
  if (!locator) return `🛡️ **Faction Embed**   ${NO}`;
  return `🛡️ **Faction Embed**   ${OK}${jumpSuffix(guildId, locator.channelId, locator.messageId)}`;
}

function serverPairRow(emojiLabel, l1, l2, guildId, envKey) {
  if (!process.env[envKey]) return `${emojiLabel}   ${NO}`;
  const s1 = l1 ? `${OK}${jumpSuffix(guildId, l1.channelId, l1.messageId)}` : NO;
  const s2 = l2 ? `${OK}${jumpSuffix(guildId, l2.channelId, l2.messageId)}` : NO;
  return `${emojiLabel}   S1 ${s1}  •  S2 ${s2}`;
}

function rotationRow(locator, guildId) {
  if (!locator) return `🗺️ **Map Rotation**   ${NO}`;
  return `🗺️ **Map Rotation**   ${OK}${jumpSuffix(guildId, locator.channelId, locator.messageId)}`;
}

function nodesRow({ total, hits }, guildId) {
  if (!total) return `📍 **Nodes**   ${NO}`;
  const posted = hits.length;
  const icon = posted === 0 ? NO : posted === total ? OK : PARTIAL;
  // Only one jump link (first hit) — too noisy to list all.
  const suffix = hits.length ? jumpSuffix(guildId, hits[0].channelId, hits[0].messageId) : '';
  return `📍 **Nodes**   ${icon}${suffix}   _(${posted}/${total} channel${total === 1 ? '' : 's'})_`;
}

// ── Menus ────────────────────────────────────────────────────────────────────

function factionMenu() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('admin_faction_select')
      .setPlaceholder('🛡️  Faction Embed — choose action')
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setValue('reload')
          .setLabel('Reload Faction Embed')
          .setDescription('Delete the current embed and post a fresh one.')
          .setEmoji('🔄'),
        new StringSelectMenuOptionBuilder()
          .setValue('reset')
          .setLabel('Reset Roles')
          .setDescription('Remove Allies / Axis roles from every member.')
          .setEmoji('♻️')
      )
  );
}

function lineupMenu() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('admin_lineup_select')
      .setPlaceholder('📋  Lineup — choose action')
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setValue('edit:S1')
          .setLabel('Edit Lineup — S1')
          .setDescription('Edit the Server 1 lineup caption.')
          .setEmoji('✏️'),
        new StringSelectMenuOptionBuilder()
          .setValue('edit:S2')
          .setLabel('Edit Lineup — S2')
          .setDescription('Edit the Server 2 lineup caption.')
          .setEmoji('✏️')
      )
  );
}

function serverMenu() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('admin_server_select')
      .setPlaceholder('🖥️  Server Details — choose action')
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setValue('post:S1')
          .setLabel('Post Server Details — S1')
          .setDescription('Publish the Server 1 details embed.')
          .setEmoji('📤'),
        new StringSelectMenuOptionBuilder()
          .setValue('post:S2')
          .setLabel('Post Server Details — S2')
          .setDescription('Publish the Server 2 details embed.')
          .setEmoji('📤'),
        new StringSelectMenuOptionBuilder()
          .setValue('edit:S1')
          .setLabel('Edit Server Details — S1')
          .setDescription('Edit the Server 1 details embed.')
          .setEmoji('✏️'),
        new StringSelectMenuOptionBuilder()
          .setValue('edit:S2')
          .setLabel('Edit Server Details — S2')
          .setDescription('Edit the Server 2 details embed.')
          .setEmoji('✏️')
      )
  );
}

function rotNodesMenu() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('admin_rotnodes_select')
      .setPlaceholder('🗺️ 📍  Map Rotation & Nodes — choose action')
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setValue('rotation:post')
          .setLabel('Post Map Rotation')
          .setDescription('Publish a fresh map rotation embed.')
          .setEmoji('📤'),
        new StringSelectMenuOptionBuilder()
          .setValue('rotation:edit')
          .setLabel('Edit Map Rotation')
          .setDescription('Edit the current rotation events.')
          .setEmoji('✏️'),
        new StringSelectMenuOptionBuilder()
          .setValue('nodes:post')
          .setLabel('Post Nodes')
          .setDescription('Publish the NODES embed to every configured channel.')
          .setEmoji('📤'),
        new StringSelectMenuOptionBuilder()
          .setValue('nodes:edit')
          .setLabel('Edit Nodes')
          .setDescription('Edit the current NODES embed fields.')
          .setEmoji('✏️')
      )
  );
}

function panelMenu() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('admin_panel_select')
      .setPlaceholder('🛠️  Panel — choose action')
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setValue('refresh')
          .setLabel('Refresh Status')
          .setDescription('Re-check posted state of every embed.')
          .setEmoji('🔄'),
        new StringSelectMenuOptionBuilder()
          .setValue('clearlogs')
          .setLabel('Clear Log Channel')
          .setDescription('Delete every message in the admin log channel.')
          .setEmoji('🧹')
      )
  );
}

// ── Footer ───────────────────────────────────────────────────────────────────

function buildFooter() {
  const base = `v${pkg.version}  •  deployed ${humanizeAgo(Date.now() - BOT_STARTED_AT_MS)}`;
  const last = loadLastAction();
  if (!last) return base;
  const who = last.userTag || `@${last.userId}`;
  return `${base}  •  last: ${last.action} by ${who} ${humanizeAgo(Date.now() - last.ts)}`;
}

// ── Payload builder ──────────────────────────────────────────────────────────

async function buildPanelPayload(client, guildId) {
  const [fac, l1, l2, s1, s2, rot, nodes] = await Promise.all([
    probeFaction(client),
    probeLineup(client, 'S1'),
    probeLineup(client, 'S2'),
    probeServer(client, 'S1'),
    probeServer(client, 'S2'),
    probeRotation(client),
    probeNodes(client)
  ]);

  const description = [
    factionRow(fac, guildId),
    serverPairRow('📋 **Lineup**', l1, l2, guildId, 'LINEUP_CHANNEL'),
    serverPairRow('🖥️ **Server Details**', s1, s2, guildId, 'SERVER_DETAILS_CHANNEL'),
    rotationRow(rot, guildId),
    nodesRow(nodes, guildId),
    '',
    `_${OK} posted  •  ${PARTIAL} partial  •  ${NO} not posted  •  ↗️ jump to message_`
  ].join('\n');

  const embed = new EmbedBuilder()
    .setTitle('⚙️  Admin Panel')
    .setColor(0x011327)
    .setDescription(description)
    .setFooter({ text: buildFooter() });

  return {
    embeds: [embed],
    components: [factionMenu(), lineupMenu(), serverMenu(), rotNodesMenu(), panelMenu()]
  };
}

// ── Auto-refresh helper ──────────────────────────────────────────────────────
// Edits the panel message in place after an admin action. Called from the
// interaction router after each state-changing handler. Failures are
// swallowed — we never want a panel-refresh error to leak into the user's
// action confirmation.

async function refreshPanelMessage(interaction) {
  try {
    const msg = interaction.message;
    if (!msg) return;
    const payload = await buildPanelPayload(interaction.client, interaction.guildId);
    await msg.edit(payload);
  } catch (_) {}
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Open the admin control panel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    const payload = await buildPanelPayload(interaction.client, interaction.guildId);
    await interaction.editReply(payload);
  },

  buildPanelPayload,
  refreshPanelMessage
};
