const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

function createFactionButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('allies').setLabel('🔵 Allies').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('axis').setLabel('🔴 Axis').setStyle(ButtonStyle.Danger)
  );
}

/**
 * Build the three rows of class signup buttons for an event.
 * @param {string} eventId - The unique event ID
 * @returns {ActionRowBuilder[]}
 */
function createActionButtons(eventId) {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`event_signup_${eventId}_commander`).setLabel('🧭 Commander').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`event_signup_${eventId}_artillery`).setLabel('💥 Artillery').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`event_signup_${eventId}_infantry`).setLabel('🪖 Infantry').setStyle(ButtonStyle.Primary)
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`event_signup_${eventId}_recon`).setLabel('🎯 Recon').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`event_signup_${eventId}_tank`).setLabel('🛡️ Tank').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`event_signup_${eventId}_streamer`).setLabel('📺 Streamer').setStyle(ButtonStyle.Primary)
  );
  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`event_signup_${eventId}_leave`).setLabel('❌ Leave').setStyle(ButtonStyle.Danger)
  );
  return [row1, row2, row3];
}

function createAdminPanelButtons() {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('admin_reset').setLabel('🧩 Reset Roles').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('admin_reload').setLabel('🔄 Reload Embed').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('admin_clearlogs').setLabel('🗑️ Clear Logs').setStyle(ButtonStyle.Danger)
  );
  return [row1];
}

module.exports = { createFactionButtons, createActionButtons, createAdminPanelButtons };
