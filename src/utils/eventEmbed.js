const { EmbedBuilder } = require('discord.js');
const { CLASS_EMOJIS } = require('../config/constants');

function formatMembersList(members) {
  if (!members || members.length === 0) return '—';
  return members.map((id, i) => `${i + 1}. <@${id}>`).join('\n');
}

function getProgressBar(filled, limit) {
  const percentage = (filled / limit) * 10;
  const filled_blocks = Math.floor(percentage);
  const empty_blocks = 10 - filled_blocks;
  return '█'.repeat(filled_blocks) + '░'.repeat(empty_blocks);
}

module.exports = function buildEventEmbed(eventData) {
  const generateClassField = (className, classData) => {
    const emoji = CLASS_EMOJIS[className] || '❓';
    const filled = classData.members.length;
    const limit = classData.limit;
    const progress = getProgressBar(filled, limit);
    
    let description = `**[${progress}] ${filled}/${limit}**\n`;
    
    if (classData.members.length > 0) {
      description += '**Members:**\n' + formatMembersList(classData.members);
    } else {
      description += '**Members:** —';
    }
    
    if (classData.queue.length > 0) {
      description += `\n\n**Queue (${classData.queue.length}):**\n`;
      // Show first 3 in queue
      const queueDisplay = classData.queue.slice(0, 3).map((id, i) => `${i + 1}. <@${id}>`).join('\n');
      description += queueDisplay;
      
      if (classData.queue.length > 3) {
        description += `\n...and ${classData.queue.length - 3} more waiting`;
      }
    }
    
    return {
      name: `${emoji} ${className.toUpperCase()} (${filled}/${limit})`,
      value: description,
      inline: false
    };
  };

  const fields = [
    generateClassField('commander', eventData.classes.commander),
    generateClassField('artillery', eventData.classes.artillery),
    generateClassField('infantry', eventData.classes.infantry),
    generateClassField('recon', eventData.classes.recon),
    generateClassField('tank', eventData.classes.tank),
    generateClassField('streamer', eventData.classes.streamer)
  ];

  return new EmbedBuilder()
    .setTitle(`📋 Event: ${eventData.eventName}`)
    .setDescription(
      `**Event ID:** \`${eventData.eventId}\`\n` +
      `**Created by:** <@${eventData.createdBy}>\n` +
      `**Click the button below to sign up!**`
    )
    .addFields(...fields)
    .setColor('#0099FF')
    .setFooter({ text: `Created at ${new Date(eventData.createdAt).toLocaleString()}` })
    .setTimestamp();
};
