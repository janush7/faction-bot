const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  EmbedBuilder
} = require('discord.js');

const { loadLineupData, loadServerData } = require('../../utils/lineupStore');
const { loadRotationMsgId }              = require('../../utils/rotationStore');
const pkg = require('../../../package.json');

const OK = '🟢';
const NO = '🔴';
const BOT_STARTED_AT_MS = Date.now();

function humanizeAgo(ms) {
  const s = Math.floor(ms / 1000);
  if (s < 60)    return `${s}s ago`;
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// ── Status probes ────────────────────────────────────────────────────────────
// Each probe actually verifies the current state against Discord instead of
// trusting local cache (cache may point at a message that was manually
// deleted). Probes return booleans / small summaries. All probes catch
// their own errors and fall back to "not posted" so the panel never throws.

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
  const icon = posted === 0 ? NO : posted === total ? OK : '🟡';
  return `📍 **Nodes**   ${icon}   _(${posted}/${total} channel${total === 1 ? '' : 's'})_`;
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
    `_${OK} posted  •  🟡 partial  •  ${NO} not posted_`
  ].join('\n');

  const embed = new EmbedBuilder()
    .setTitle('⚙️  Admin Panel')
    .setColor(0x011327)
    .setDescription(description)
    .setFooter({
      text: `v${pkg.version}  •  deployed ${humanizeAgo(Date.now() - BOT_STARTED_AT_MS)}`
    });

  // Row 1 — Faction controls + Lineup edit shortcuts
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('admin_reload')
      .setLabel('Reload Faction Embed')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🔄'),
    new ButtonBuilder()
      .setCustomId('admin_reset')
      .setLabel('Reset Roles')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('♻️'),
    new ButtonBuilder()
      .setCustomId('admin_edit_caption:S1')
      .setLabel('Edit Lineup — S1')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('✏️'),
    new ButtonBuilder()
      .setCustomId('admin_edit_caption:S2')
      .setLabel('Edit Lineup — S2')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('✏️')
  );

  // Row 2 — Server Details select menu
  const row2 = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('admin_server_select')
      .setPlaceholder('🖥️  Server Details — choose action')
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setValue('post:S1')
          .setLabel('Post Server Details — S1')
          .setEmoji('📤'),
        new StringSelectMenuOptionBuilder()
          .setValue('post:S2')
          .setLabel('Post Server Details — S2')
          .setEmoji('📤'),
        new StringSelectMenuOptionBuilder()
          .setValue('edit:S1')
          .setLabel('Edit Server Details — S1')
          .setEmoji('✏️'),
        new StringSelectMenuOptionBuilder()
          .setValue('edit:S2')
          .setLabel('Edit Server Details — S2')
          .setEmoji('✏️')
      )
  );

  // Row 3 — Nodes + Rotation
  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('admin_post_nodes')
      .setLabel('Post Nodes')
      .setStyle(ButtonStyle.Success)
      .setEmoji('📤'),
    new ButtonBuilder()
      .setCustomId('admin_edit_nodes')
      .setLabel('Edit Nodes')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('✏️'),
    new ButtonBuilder()
      .setCustomId('admin_post_rotation')
      .setLabel('Post Rotation')
      .setStyle(ButtonStyle.Success)
      .setEmoji('📤'),
    new ButtonBuilder()
      .setCustomId('admin_edit_rotation')
      .setLabel('Edit Rotation')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('✏️')
  );

  // Row 4 — Logs + Refresh
  const row4 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('admin_clearlogs')
      .setLabel('Clear Log Channel')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🧹'),
    new ButtonBuilder()
      .setCustomId('admin_refresh')
      .setLabel('Refresh')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🔄')
  );

  return { embeds: [embed], components: [row1, row2, row3, row4] };
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
