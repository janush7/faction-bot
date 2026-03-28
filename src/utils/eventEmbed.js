const { EmbedBuilder } = require('discord.js');
const { CLASS_EMOJIS } = require('../config/constants');

function formatMembersList(members) {
  if (!members || members.length === 0) return '—';
  return members.map((id, i) => `${i + 1}. <@${id}>`).join('\n');
}

function getProgressBar(filled, limit) {
  const filledBlocks = Math.floor((filled / limit) * 10);
  return '█'.repeat(filledBlocks) + '░'.repeat(10 - filledBlocks);
}

module.exports = function buildEventEmbed(eventData) {
  const generateClassField = (className, classData) => {
    const emoji = CLASS_EMOJIS[className] || '❓';
    const { members, queue, limit } = classData;
    const progress = getProgressBar(members.length, limit);

    let value = `**[${progress}] ${members.length}/${limit}**\n`;
    value += members.length > 0
      ? '**Members:**\n' + formatMembersList(members)
      : '**Members:** —';

    if (queue.length > 0) {
      const display = queue.slice(0, 3).map((id, i) => `${i + 1}. <@${id}>`).join('\n');
      value += `\n\n**Queue (${queue.length}):**\n${display}`;
      if (queue.length > 3) value += `\n…and ${queue.length - 3} more`;
    }

    return {
      name: `${emoji} ${className.toUpperCase()} (${members.length}/${limit})`,
      value,
      inline: false,
    };
  };

  const fields = Object.entries(eventData.classes).map(([name, data]) =>
    generateClassField(name, data)
  );

  return new EmbedBuilder()
    .setTitle(`📋 Event: ${eventData.title}`)
    .setDescription(
      `**Event ID:** \`${eventData.eventId}\`\n` +
      `**Created by:** <@${eventData.createdBy}>\n` +
      `**Click a button below to sign up!**`
    )
    .addFields(...fields)
    .setColor('#0099FF')
    .setFooter({ text: `Created at ${new Date(eventData.createdAt).toLocaleString()}` })
    .setTimestamp();
};
