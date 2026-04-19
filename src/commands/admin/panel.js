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
const BOT_STARTED_AT = Math.floor(Date.now() / 1000);

function channelRef(id) {
  return id ? `<#${id}>` : '_not set_';
}

function factionStatusLine() {
  const ch = process.env.FACTION_CHANNEL;
  return `🛡️ **Faction Embed** in ${channelRef(ch)} — ${ch ? OK : NO}`;
}

function lineupStatusLine() {
  const ch = process.env.LINEUP_CHANNEL;
  if (!ch) return `📋 **Lineup** — channel not configured ${NO}`;
  const s1 = loadLineupData(ch, 'S1') ? OK : NO;
  const s2 = loadLineupData(ch, 'S2') ? OK : NO;
  return `📋 **Lineup** in ${channelRef(ch)} — S1 ${s1}  •  S2 ${s2}`;
}

function serverStatusLine() {
  const ch = process.env.SERVER_DETAILS_CHANNEL;
  if (!ch) return `🖥️ **Server Details** — channel not configured ${NO}`;
  const s1 = loadServerData(ch, 'S1') ? OK : NO;
  const s2 = loadServerData(ch, 'S2') ? OK : NO;
  return `🖥️ **Server Details** in ${channelRef(ch)} — S1 ${s1}  •  S2 ${s2}`;
}

function rotationStatusLine() {
  const ch = process.env.MAP_ROTATION_CHANNEL;
  if (!ch) return `🗺️ **Map Rotation** — channel not configured ${NO}`;
  return `🗺️ **Map Rotation** in ${channelRef(ch)} — ${loadRotationMsgId(ch) ? OK : NO}`;
}

function nodesStatusLine() {
  const channels = (process.env.NODES_CHANNELS || '').split(',').map(s => s.trim()).filter(Boolean);
  const posted = loadNodesData() ? OK : NO;
  const mentions = channels.length ? channels.map(c => `<#${c}>`).join(' ') : '_none_';
  return `📍 **Nodes** in ${mentions} — cache ${posted}`;
}

function buildPanelPayload() {
  const embed = new EmbedBuilder()
    .setTitle('⚙️  Admin Panel')
    .setColor(0x011327)
    .setDescription(
      [
        factionStatusLine(),
        lineupStatusLine(),
        serverStatusLine(),
        rotationStatusLine(),
        nodesStatusLine()
      ].join('\n')
    )
    .setFooter({
      text: `v${pkg.version}  •  deployed — click Refresh for live status`
    })
    .addFields({
      name: '\u200b',
      value: `Deployed <t:${BOT_STARTED_AT}:R>  •  Status fetched <t:${Math.floor(Date.now() / 1000)}:R>`
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
