const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const Event = require('../../models/Event');
const buildEventEmbed = require('../../utils/eventEmbed');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('create-event')
    .setDescription('Create a new event with signup buttons')
    .addStringOption(option =>
      option
        .setName('name')
        .setDescription('Name of the event')
        .setRequired(true)
        .setMaxLength(100)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  async execute(interaction) {
    try {
      // Verify user is admin
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return await interaction.reply({
          content: '❌ Only administrators can create events',
          ephemeral: true
        });
      }

      await interaction.deferReply({ ephemeral: true });

      const eventName = interaction.options.getString('name');
      const eventId = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Create event document
      const eventData = {
        eventId: eventId,
        messageId: '', // Will be set after message is sent
        channelId: interaction.channelId,
        guildId: interaction.guildId,
        createdBy: interaction.user.id,
        eventName: eventName,
        classes: {
          commander: { limit: 2, members: [], queue: [] },
          artillery: { limit: 2, members: [], queue: [] },
          infantry: { limit: 12, members: [], queue: [] },
          recon: { limit: 2, members: [], queue: [] },
          tank: { limit: 6, members: [], queue: [] },
          streamer: { limit: 1, members: [], queue: [] }
        }
      };

      const event = new Event(eventData);
      await event.save();

      // Create embed
      const embed = buildEventEmbed(eventData);

      // Create button rows
      const row1 = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`event_signup_${eventId}_commander`)
            .setLabel('🧭 Commander')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`event_signup_${eventId}_artillery`)
            .setLabel('💥 Artillery')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`event_signup_${eventId}_infantry`)
            .setLabel('🪖 Infantry')
            .setStyle(ButtonStyle.Primary)
        );

      const row2 = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`event_signup_${eventId}_recon`)
            .setLabel('🎯 Recon')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`event_signup_${eventId}_tank`)
            .setLabel('🛡️ Tank')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`event_signup_${eventId}_streamer`)
            .setLabel('📺 Streamer')
            .setStyle(ButtonStyle.Primary)
        );

      const row3 = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`event_signup_${eventId}_leave`)
            .setLabel('❌ Leave')
            .setStyle(ButtonStyle.Danger)
        );

      // Send the event message
      const message = await interaction.channel.send({
        embeds: [embed],
        components: [row1, row2, row3]
      });

      // Update event with message ID
      event.messageId = message.id;
      await event.save();

      // Reply to command
      await interaction.editReply({
        content: `✅ Event **${eventName}** created!\n**Event ID:** \`${eventId}\``
      });

      logger.success(`Event created: ${eventId} by ${interaction.user.tag}`);

    } catch (error) {
      logger.error('Error creating event:', error);
      
      try {
        await interaction.editReply({
          content: '❌ Failed to create event'
        });
      } catch (e) {
        logger.error('Could not send error reply:', e);
      }
    }
  }
};
