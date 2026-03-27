const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Event = require('../../models/Event');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('delete-event')
    .setDescription('Delete an event')
    .addStringOption(option =>
      option
        .setName('event-id')
        .setDescription('The event ID to delete')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  async execute(interaction) {
    try {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return await interaction.reply({
          content: '❌ Only administrators can delete events',
          ephemeral: true
        });
      }

      await interaction.deferReply({ ephemeral: true });

      const eventId = interaction.options.getString('event-id');

      // Find and delete event
      const event = await Event.findOneAndDelete({ eventId });

      if (!event) {
        return await interaction.editReply({
          content: '❌ Event not found'
        });
      }

      // Try to delete the message
      try {
        const channel = await interaction.client.channels.fetch(event.channelId);
        const message = await channel.messages.fetch(event.messageId);
        await message.delete();
      } catch (e) {
        logger.warn(`Could not delete event message: ${e.message}`);
      }

      await interaction.editReply({
        content: `✅ Event **${event.eventName}** has been deleted`
      });

      logger.success(`Event deleted: ${eventId} by ${interaction.user.tag}`);

    } catch (error) {
      logger.error('Error deleting event:', error);
      
      try {
        await interaction.editReply({
          content: '❌ Failed to delete event'
        });
      } catch (e) {
        logger.error('Could not send error reply:', e);
      }
    }
  }
};
