const eventStore = require('../store/eventStore');
const buildEventEmbed = require('../utils/eventEmbed');
const logger = require('../utils/logger');
const { REQUIRED_ROLES_FOR_EVENT } = require('../config/constants');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    if (!interaction.isButton()) return;

    const buttonId = interaction.customId;
    if (!buttonId.startsWith('event_signup_')) return;

    try {
      // Parse button ID: event_signup_{eventId}_{action}
      const parts = buttonId.split('_');
      const action = parts[parts.length - 1];          // last segment
      const eventId = parts.slice(2, -1).join('_');    // everything in between

      const event = eventStore.findById(eventId);

      if (!event) {
        return await interaction.reply({ content: '❌ Event not found', ephemeral: true });
      }

      const userId = interaction.user.id;
      const member = await interaction.guild.members.fetch(userId).catch(() => null);

      if (!member) {
        return await interaction.reply({ content: '❌ Could not find you in this server', ephemeral: true });
      }

      // ── LEAVE ─────────────────────────────────────────────────────────────
      if (action === 'leave') {
        let leftFrom = null;

        for (const [className, classData] of Object.entries(event.classes)) {
          const memberIdx = classData.members.indexOf(userId);
          if (memberIdx > -1) {
            classData.members.splice(memberIdx, 1);
            leftFrom = className;

            // Promote first person from queue
            if (classData.queue.length > 0) {
              const promotedId = classData.queue.shift();
              classData.members.push(promotedId);
              try {
                const promoted = await interaction.client.users.fetch(promotedId);
                await promoted.send(
                  `✅ You have been promoted from the queue for **${className}** in event **${event.title}**!`
                ).catch(() => logger.warn(`Could not DM promoted user ${promotedId}`));
              } catch (err) {
                logger.warn(`Could not notify promoted user: ${err.message}`);
              }
            }
            break;
          }

          const queueIdx = classData.queue.indexOf(userId);
          if (queueIdx > -1) {
            classData.queue.splice(queueIdx, 1);
            leftFrom = className;
            break;
          }
        }

        eventStore.persist();
        await updateEventMessage(interaction, event);

        await interaction.reply({
          content: leftFrom
            ? `✅ You have left the **${leftFrom}** class`
            : '⚠️ You were not signed up for any class',
          ephemeral: true,
        });

        logger.info(`${interaction.user.tag} left ${leftFrom ?? 'no class'} in event ${eventId}`);
        return;
      }

      // ── SIGNUP ────────────────────────────────────────────────────────────
      const className = action;

      if (!event.classes[className]) {
        return await interaction.reply({ content: '❌ Invalid class', ephemeral: true });
      }

      // Must have required role
      const hasRole = member.roles.cache.some((r) => REQUIRED_ROLES_FOR_EVENT.includes(r.name));
      if (!hasRole) {
        return await interaction.reply({
          content: `❌ You need the **${REQUIRED_ROLES_FOR_EVENT.join('** or **')}** role to sign up`,
          ephemeral: true,
        });
      }

      // Already in this class?
      if (
        event.classes[className].members.includes(userId) ||
        event.classes[className].queue.includes(userId)
      ) {
        return await interaction.reply({
          content: `⚠️ You are already signed up for **${className}**`,
          ephemeral: true,
        });
      }

      // Already in another class?
      let alreadyIn = null;
      for (const [checkClass, classData] of Object.entries(event.classes)) {
        if (checkClass !== className &&
            (classData.members.includes(userId) || classData.queue.includes(userId))) {
          alreadyIn = checkClass;
          break;
        }
      }
      if (alreadyIn) {
        return await interaction.reply({
          content: `⚠️ You are already signed up for **${alreadyIn}**. Leave first before joining another class.`,
          ephemeral: true,
        });
      }

      // ── Accept signup ─────────────────────────────────────────────────────
      const classData = event.classes[className];

      if (classData.members.length < classData.limit) {
        classData.members.push(userId);
        eventStore.persist();
        await updateEventMessage(interaction, event);
        await interaction.reply({ content: `✅ You have been signed up for **${className}**!`, ephemeral: true });
        logger.info(`${interaction.user.tag} signed up for ${className} in event ${eventId}`);
      } else {
        classData.queue.push(userId);
        eventStore.persist();
        await updateEventMessage(interaction, event);
        const pos = classData.queue.indexOf(userId) + 1;
        await interaction.reply({
          content:
            `⏳ The **${className}** class is full!\n` +
            `You are in the queue at position **#${pos}**.\n` +
            `You will be promoted automatically when a spot opens up.`,
          ephemeral: true,
        });
        logger.info(`${interaction.user.tag} queued for ${className} in event ${eventId}`);
      }

    } catch (error) {
      logger.error('Error processing event signup:', error);
      try {
        await interaction.reply({ content: '❌ An error occurred. Please try again.', ephemeral: true });
      } catch (e) {
        logger.error('Could not send error reply:', e);
      }
    }
  },
};

// ── Helper: update the event embed message ─────────────────────────────────
async function updateEventMessage(interaction, event) {
  try {
    const channel = await interaction.client.channels.fetch(event.channelId);
    const message = await channel.messages.fetch(event.messageId);

    const embed = buildEventEmbed(event);

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`event_signup_${event.eventId}_commander`).setLabel('🧭 Commander').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`event_signup_${event.eventId}_artillery`).setLabel('💥 Artillery').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`event_signup_${event.eventId}_infantry`).setLabel('🪖 Infantry').setStyle(ButtonStyle.Primary)
    );
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`event_signup_${event.eventId}_recon`).setLabel('🎯 Recon').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`event_signup_${event.eventId}_tank`).setLabel('🛡️ Tank').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`event_signup_${event.eventId}_streamer`).setLabel('📺 Streamer').setStyle(ButtonStyle.Primary)
    );
    const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`event_signup_${event.eventId}_leave`).setLabel('❌ Leave').setStyle(ButtonStyle.Danger)
    );

    await message.edit({ embeds: [embed], components: [row1, row2, row3] });
  } catch (error) {
    logger.error('Could not update event message:', error);
  }
}
