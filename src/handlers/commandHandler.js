const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

module.exports = (client) => {
  const commands = [];
  const commandsPath = path.join(__dirname, '..', 'commands');

  // Recursive function to load commands from nested folders
  function loadCommands(dir) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);

      // If it's a directory, recurse into it
      if (stat.isDirectory()) {
        loadCommands(fullPath);
      }
      // If it's a JS file, load it as a command
      else if (file.endsWith('.js')) {
        try {
          const command = require(fullPath);
          
          if (command.data && command.execute) {
            client.commands.set(command.data.name, command);
            commands.push(command.data.toJSON());
            logger.info(`Loaded command: ${command.data.name}`);
          } else {
            logger.warn(`Skipped invalid command at ${fullPath}`);
          }
        } catch (error) {
          logger.error(`Failed to load command at ${fullPath}:`, error);
        }
      }
    }
  }

  // Initialize commands collection
  if (!client.commands) {
    client.commands = new Map();
  }

  // Load all commands
  loadCommands(commandsPath);
  logger.success(`Loaded ${commands.length} slash commands`);

  // Handle command interactions
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) {
      logger.warn(`Unknown command: ${interaction.commandName}`);
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      logger.error(`Error executing command ${interaction.commandName}:`, error);
      
      const errorMessage = {
        content: '❌ There was an error executing this command!',
        ephemeral: true
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    }
  });
};
