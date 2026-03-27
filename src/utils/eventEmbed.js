const { EmbedBuilder } = require('discord.js');

function formatList(arr) {
  if (!arr || arr.length === 0) return '—';
  return arr.map((id, i) => `${i + 1}. <@${id}>`).join('\n');
}

module.exports = function buildEventEmbed(eventData) {
  return new EmbedBuilder()
    .setTitle('📋 Event Signup')
    .setColor('#2b2d31')
    .addFields(
      {
        name: `🧭 Commander (${eventData.classes.commander.members.length}/${eventData.classes.commander.limit})`,
        value: formatList(eventData.classes.commander.members)
      },
      {
        name: `🪖 Infantry (${eventData.classes.infantry.members.length}/${eventData.classes.infantry.limit})`,
        value: formatList(eventData.classes.infantry.members)
      },
      {
        name: `🛡 Tank (${eventData.classes.tank.members.length}/${eventData.classes.tank.limit})`,
        value: formatList(eventData.classes.tank.members)
      },
      {
        name: `🎯 Recon (${eventData.classes.recon.members.length}/${eventData.classes.recon.limit})`,
        value: formatList(eventData.classes.recon.members)
      },
      {
        name: `💥 Artillery (${eventData.classes.artillery.members.length}/${eventData.classes.artillery.limit})`,
        value: formatList(eventData.classes.artillery.members)
      },
      {
        name: `📺 Streamer (${eventData.classes.streamer.members.length}/${eventData.classes.streamer.limit})`,
        value: formatList(eventData.classes.streamer.members)
      }
    )
    .setFooter({ text: `Event ID: ${eventData.eventId}` });
};
