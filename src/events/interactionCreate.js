const Event = require('../models/Event');
const buildEventEmbed = require('../utils/eventEmbed');
const logger = require('../utils/logger');
const { REQUIRED_ROLES_FOR_EVENT } = require('../config/constants');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    // Handle button clicks for event signup
    if (!interaction.isButton()) return;

    const buttonId = interaction.customId;

    // Check if this is an event signup button
    if (!buttonId.startsWith('event_signup_')) return;

    try {
      // Parse button ID: event_signup_{eventId}_{action/className}
      const parts = buttonId.split('_');
      const action = parts[parts.length - 1]; // 'commander', 'artillery', 'leave', etc.
      const eventId = parts.slice(2, -1).join('_'); // Everything in between

      // Fetch event from database
      const event = await Event.findOne({ eventId });
      
      if (!event) {
        return await interaction.reply({
          content: '❌ Event not found',
          ephemeral: true
        });
      }

      const userId = interaction.user.id;
      const member = await interaction.guild.members.fetch(userId).catch(() => null);

      if (!member) {
        return await interaction.reply({
          content: '❌ Could not find you in this server',
          ephemeral: true
        });
      }

      // ===== HANDLE LEAVE =====
      if (action === 'leave') {
        let leftFrom = null;

        // Search all classes for this user
        for (const [className, classData] of Object.entries(event.classes)) {
          // Check if in members
          const memberIndex = classData.members.indexOf(userId);
          if (memberIndex > -1) {
            classData.members.splice(memberIndex, 1);
            leftFrom = className;

            // Promote first from queue
            if (classData.queue.length > 0) {
              const promotedUserId = classData.queue.shift();
              classData.members.push(promotedUserId);

              // Notify promoted user
              try {
                const promotedUser = await interaction.client.users.fetch(promotedUserId);
                await promotedUser.send(
                  `✅ You have been promoted from the queue for **${className}** in event **${event.eventName}**!`
                ).catch(() => {
                  logger.warn(`Could not DM user ${promotedUserId}`);
                });
              } catch (error) {
                logger.warn(`Could not notify promoted user: ${error.message}`);
              }
            }

            break;
          }

          // Check if in queue
          const queueIndex = classData.queue.indexOf(userId);
          if (queueIndex > -1) {
            classData.queue.splice(queueIndex, 1);
            leftFrom = className;
            break;
          }
        }

        // Save changes
        await event.save();

        // Update embed message
        await updateEventMessage(interaction, event);

        // Reply to user
        if (leftFrom) {
          await interaction.reply({
            content: `✅ You have left the **${leftFrom}** class`,
            ephemeral: true
          });
        } else {
          await interaction.reply({
            content: '⚠️ You were not signed up for any class',
            ephemeral: true
          });
        }

        logger.success(`User ${interaction.user.tag} left ${leftFrom || 'unknown class'} in event ${eventId}`);
        return;
      }

      // ===== HANDLE SIGNUP =====
      const className = action;

      // Validate class exists
      if (!event.classes[className]) {
        return await interaction.reply({
          content: '❌ Invalid class',
          ephemeral: true
        });
      }

      // CHECK 1: Verify user has required role
      const hasRequiredRole = member.roles.cache.some(role => 
        REQUIRED_ROLES_FOR_EVENT.includes(role.name)
      );

      if (!hasRequiredRole) {
        const requiredRoles = REQUIRED_ROLES_FOR_EVENT.join('** or **');
        return await interaction.reply({
          content: `❌ You need the **${requiredRoles}** role to sign up for events`,
          ephemeral: true
        });
      }

      // CHECK 2: Already signed up to this class?
      if (event.classes[className].members.includes(userId) || 
          event.classes[className].queue.includes(userId)) {
        return await interaction.reply({
          content: `⚠️ You are already signed up for **${className}** in this event`,
          ephemeral: true
        });
      }

      // CHECK 3: Already signed up to ANY class in this event?
      let alreadySignedClass = null;
      for (const [checkClass, classData] of Object.entries(event.classes)) {
        if (checkClass !== className && 
            (classData.members.includes(userId) || classData.queue.includes(userId))) {
          alreadySignedClass = checkClass;
          break;
        }
      }

      if (alreadySignedClass) {
        return await interaction.reply({
          content: `⚠️ You are already signed up for **${alreadySignedClass}**. There is no limit on teams - you can create a new event signup!`,
          ephemeral: true
        });
      }

      // ===== ACCEPT SIGNUP =====
      const classData = event.classes[className];

      if (classData.members.length < classData.limit) {
        // Add to members
        classData.members.push(userId);

        await event.save();
        await updateEventMessage(interaction, event);

        await interaction.reply({
          content: `✅ You have been signed up for **${className}**!`,
          ephemeral: true
        });

        logger.success(`User ${interaction.user.tag} signed up for ${className}`);
      } else {
        // Add to queue
        classData.queue.push(userId);

        await event.save();
        await updateEventMessage(interaction, event);

        const queuePosition = classData.queue.indexOf(userId) + 1;

        await interaction.reply({
          content: 
            `⏳ The **${className}** class is full!\n` +
            `You have been added to the queue at position **#${queuePosition}**\n` +
            `You will be automatically promoted when a spot opens up.`,
          ephemeral: true
        });

        logger.info(`User ${interaction.user.tag} queued for ${className}`);
      }

    } catch (error) {
      logger.error('Error processing event signup:', error);
      
      try {
        await interaction.reply({
          content: '❌ An error occurred while processing your request',
          ephemeral: true
        });
      } catch (e) {
        logger.error('Could not send error reply:', e);
      }
    }
  }
};

// Helper function to update the event embed message
async function updateEventMessage(interaction, event) {
  try {
    const channel = await interaction.client.channels.fetch(event.channelId);
    const message = await channel.messages.fetch(event.messageId);
    
    const embed = buildEventEmbed(event);

    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

    const row1 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`event_signup_${event.eventId}_commander`)
          .setLabel('🧭 Commander')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`event_signup_${event.eventId}_artillery`)
          .setLabel('💥 Artillery')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`event_signup_${event.eventId}_infantry`)
          .setLabel('🪖 Infantry')
          .setStyle(ButtonStyle.Primary)
      );

    const row2 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`event_signup_${event.eventId}_recon`)
          .setLabel('🎯 Recon')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`event_signup_${event.eventId}_tank`)
          .setLabel('🛡️ Tank')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`event_signup_${event.eventId}_streamer`)
          .setLabel('📺 Streamer')
          .setStyle(ButtonStyle.Primary)
      );

    const row3 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`event_signup_${event.eventId}_leave`)
          .setLabel('❌ Leave')
          .setStyle(ButtonStyle.Danger)
      );

    await message.edit({
      embeds: [embed],
      components: [row1, row2, row3]
    });
  } catch (error) {
    logger.error('Could not update event message:', error);
  }
}
