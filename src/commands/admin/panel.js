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

const OK = '🟢';
const NO = '🔴';

function lineupStatusLine() {
  const ch = process.env.LINEUP_CHANNEL;
  if (!ch) return `📋 **Lineup** — channel not configured ${NO}`;
  const s1 = loadLineupData(ch, 'S1') ? OK : NO;
  const s2 = loadLineupData(ch, 'S2') ? OK : NO;
  return `📋 **Lineup** — S1 ${s1}  •  S2 ${s2}`;
}

function serverStatusLine() {
  const ch = process.env.SERVER_DETAILS_CHANNEL;
  if (!ch) return `🖥️ **Server Details** — channel not configured ${NO}`;
  const s1 = loadServerData(ch, 'S1') ? OK : NO;
  const s2 = loadServerData(ch, 'S2') ? OK : NO;
  return `🖥️ **Server Details** — S1 ${s1}  •  S2 ${s2}`;
}

function rotationStatusLine() {
  const ch = process.env.MAP_ROTATION_CHANNEL;
  if (!ch) return `🗺️ **Map Rotation** — channel not configured ${NO}`;
  return `🗺️ **Map Rotation** — ${loadRotationMsgId(ch) ? OK : NO}`;
}

function nodesStatusLine() {
  const channels = (process.env.NODES_CHANNELS || '').split(',').map(s => s.trim()).filter(Boolean);
  const posted = loadNodesData() ? OK : NO;
  return `📍 **Nodes** — ${channels.length} channel(s) configured  •  cache ${posted}`;
}

function factionStatusLine() {
  const ch = process.env.FACTION_CHANNEL;
  return `🛡️ **Faction Embed** — ${ch ? OK : NO}${ch ? '' : ' (channel not configured)'}`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Open the admin control panel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
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
      .setFooter({ text: '🟢 data cached (ready to edit)   •   🔴 not yet posted or no cache' });

    // Row 1 — Faction (reload + destructive reset)
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

    // Row 2 — Server Details (select menu: 4 actions condensed into one control)
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

    // Row 4 — Logs
    const row4 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_clearlogs')
        .setLabel('Clear Log Channel')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🧹')
    );

    await interaction.reply({
      embeds: [embed],
      components: [row1, row2, row3, row4],
      flags: 64
    });
  }
};
