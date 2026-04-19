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
const { loadNodesData }                  = require('../../utils/nodesStore');
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

function factionLine() {
  return `🛡️ **Faction Embed**   ${process.env.FACTION_CHANNEL ? OK : NO}`;
}

function lineupLine() {
  const ch = process.env.LINEUP_CHANNEL;
  if (!ch) return `📋 **Lineup**   ${NO}`;
  return `📋 **Lineup**   S1 ${loadLineupData(ch, 'S1') ? OK : NO}  •  S2 ${loadLineupData(ch, 'S2') ? OK : NO}`;
}

function serverLine() {
  const ch = process.env.SERVER_DETAILS_CHANNEL;
  if (!ch) return `🖥️ **Server Details**   ${NO}`;
  return `🖥️ **Server Details**   S1 ${loadServerData(ch, 'S1') ? OK : NO}  •  S2 ${loadServerData(ch, 'S2') ? OK : NO}`;
}

function rotationLine() {
  const ch = process.env.MAP_ROTATION_CHANNEL;
  return `🗺️ **Map Rotation**   ${ch && loadRotationMsgId(ch) ? OK : NO}`;
}

function nodesLine() {
  const channels = (process.env.NODES_CHANNELS || '').split(',').map(s => s.trim()).filter(Boolean);
  const suffix = channels.length ? `   _(${channels.length} channel${channels.length === 1 ? '' : 's'})_` : '';
  return `📍 **Nodes**   ${loadNodesData() ? OK : NO}${suffix}`;
}

function buildPanelPayload() {
  const description = [
    factionLine(),
    lineupLine(),
    serverLine(),
    rotationLine(),
    nodesLine(),
    '',
    `_${OK} posted  •  ${NO} not posted_`
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
    await interaction.reply({ ...buildPanelPayload(), flags: 64 });
  },

  buildPanelPayload
};
