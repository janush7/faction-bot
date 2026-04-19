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

// ── Status probes ────────────────────────────────────────────────────────────
// Each probe verifies the current state against Discord instead of trusting
// local cache (cache may point at a message that was manually deleted).
// Probes catch their own errors and degrade to "not posted" so the panel
// never throws.

async function messageExists(client, channelId, messageId) {
  if (!channelId || !messageId) return false;
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel) return false;
    const msg = await channel.messages.fetch(messageId);
    return !!msg;
  } catch (_) {
    return false;
  }
}

async function probeFaction(client) {
  const ch = process.env.FACTION_CHANNEL;
  if (!ch) return false;
  try {
    const channel = await client.channels.fetch(ch);
    if (!channel) return false;
    const msgs = await channel.messages.fetch({ limit: 50 });
    return msgs.some(m =>
      m.author.id === client.user.id &&
      m.embeds.some(e => e.title === 'Choose your side!')
    );
  } catch (_) {
    return false;
  }
}

async function probeLineup(client, server) {
  const ch = process.env.LINEUP_CHANNEL;
  if (!ch) return false;
  const data = loadLineupData(ch, server);
  return messageExists(client, ch, data?.messageId);
}

async function probeServer(client, server) {
  const ch = process.env.SERVER_DETAILS_CHANNEL;
  if (!ch) return false;
  const data = loadServerData(ch, server);
  return messageExists(client, ch, data?.messageId);
}

async function probeRotation(client) {
  const ch = process.env.MAP_ROTATION_CHANNEL;
  if (!ch) return false;
  return messageExists(client, ch, loadRotationMsgId(ch));
}

async function probeNodes(client) {
  const channels = (process.env.NODES_CHANNELS || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  if (!channels.length) return { posted: 0, total: 0 };

  const results = await Promise.all(channels.map(async cid => {
    try {
      const ch = await client.channels.fetch(cid);
      if (!ch) return false;
      const msgs = await ch.messages.fetch({ limit: 50 });
      return msgs.some(m =>
        m.author.id === client.user.id &&
        m.embeds.some(e => e.title === 'NODES')
      );
    } catch (_) {
      return false;
    }
  }));

  return { posted: results.filter(Boolean).length, total: channels.length };
}

// ── Description rows ─────────────────────────────────────────────────────────

function factionRow(posted) {
  return `🛡️ **Faction Embed**   ${posted ? OK : NO}`;
}

function lineupRow(s1, s2) {
  if (!process.env.LINEUP_CHANNEL) return `📋 **Lineup**   ${NO}`;
  return `📋 **Lineup**   S1 ${s1 ? OK : NO}  •  S2 ${s2 ? OK : NO}`;
}

function serverRow(s1, s2) {
  if (!process.env.SERVER_DETAILS_CHANNEL) return `🖥️ **Server Details**   ${NO}`;
  return `🖥️ **Server Details**   S1 ${s1 ? OK : NO}  •  S2 ${s2 ? OK : NO}`;
}

function rotationRow(posted) {
  return `🗺️ **Map Rotation**   ${posted ? OK : NO}`;
}

function nodesRow({ posted, total }) {
  if (!total) return `📍 **Nodes**   ${NO}`;
  const icon = posted === 0 ? NO : posted === total ? OK : PARTIAL;
  return `📍 **Nodes**   ${icon}   _(${posted}/${total} channel${total === 1 ? '' : 's'})_`;
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

// ── Payload builder ──────────────────────────────────────────────────────────

async function buildPanelPayload(client) {
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
    factionRow(fac),
    lineupRow(l1, l2),
    serverRow(s1, s2),
    rotationRow(rot),
    nodesRow(nodes),
    '',
    `_${OK} posted  •  ${PARTIAL} partial  •  ${NO} not posted_`
  ].join('\n');

  const embed = new EmbedBuilder()
    .setTitle('⚙️  Admin Panel')
    .setColor(0x011327)
    .setDescription(description)
    .setFooter({
      text: `v${pkg.version}  •  deployed ${humanizeAgo(Date.now() - BOT_STARTED_AT_MS)}`
    });

  return {
    embeds: [embed],
    components: [factionMenu(), lineupMenu(), serverMenu(), rotNodesMenu(), panelMenu()]
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Open the admin control panel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    const payload = await buildPanelPayload(interaction.client);
    await interaction.editReply(payload);
  },

  buildPanelPayload
};
