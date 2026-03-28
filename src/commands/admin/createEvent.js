const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const eventStore = require('../../store/eventStore');
const buildEventEmbed = require('../../utils/eventEmbed');
const { createActionButtons } = require('../../utils/buttons');
const { createErrorEmbed } = require('../../utils/embeds');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('create-event')
    .setDescription('Create a new faction event')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) =>
      option.setName('title').setDescription('Event title').setRequired(true).setMaxLength(100)
    )
    .addStringOption((option) =>
      option.setName('description').setDescription('Event description').setRequired(true).setMaxLength(1000)
    )
    .addStringOption((option) =>
      option.setName('date').setDescription('Event date (YYYY-MM-DD)').setRequired(true)
    )
    .addStringOption((option) =>
      option.setName('time').setDescription('Event time in UTC (HH:MM)').setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName('max-participants')
        .setDescription('Maximum number of participants')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(500)
    ),

  async execute(interaction) {
    const title = interaction.options.getString('title');
    const description = interaction.options.getString('description');
    const dateStr = interaction.options.getString('date');
    const timeStr = interaction.options.getString('time');
    const maxParticipants = interaction.options.getInteger('max-participants');

    // ── Input validation ──────────────────────────────────────────────────────
    const dateRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

    if (!dateRegex.test(dateStr)) {
      return interaction.reply({
        embeds: [createErrorEmbed('Invalid Date', 'Please provide a valid date in **YYYY-MM-DD** format (e.g. 2025-12-31).')],
        ephemeral: true,
      });
    }

    if (!timeRegex.test(timeStr)) {
      return interaction.reply({
        embeds: [createErrorEmbed('Invalid Time', 'Please provide a valid UTC time in **HH:MM** format (e.g. 18:30).')],
        ephemeral: true,
      });
    }

    const eventDate = new Date(`${dateStr}T${timeStr}:00.000Z`);
    if (isNaN(eventDate.getTime())) {
      return interaction.reply({
        embeds: [createErrorEmbed('Invalid Date/Time', 'The date and time combination is invalid. Please check your input.')],
        ephemeral: true,
      });
    }

    if (eventDate < new Date()) {
      return interaction.reply({
        embeds: [createErrorEmbed('Past Date', 'The event date must be in the future.')],
        ephemeral: true,
      });
    }

    await interaction.deferReply();

    try {
      const event = eventStore.create({
        title,
        description,
        date: eventDate.toISOString(),
        maxParticipants,
        createdBy: interaction.user.id,
        guildId: interaction.guild.id,
      });

      const embed = buildEventEmbed(event);
      const buttons = createActionButtons(event.eventId);

      const message = await interaction.editReply({
        embeds: [embed],
        components: buttons,
      });

      // Store Discord message/channel IDs back into the event
      event.messageId = message.id;
      event.channelId = message.channelId;
      eventStore.persist();

      logger.info(`Event created: "${title}" by ${interaction.user.tag} (ID: ${event.eventId})`);
    } catch (error) {
      logger.error('Error creating event:', error);
      await interaction.editReply({
        embeds: [createErrorEmbed('Error', 'An error occurred while creating the event. Please try again.')],
      });
    }
  },
};
