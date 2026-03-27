module.exports = {
  FACTIONS: {
    ALLIES: 'allies',
    AXIS: 'axis'
  },

  EVENT_LIMITS: {
    commander: 2,
    artillery: 2,
    infantry: 12,
    recon: 2,
    tank: 6,
    streamer: 1
  },

  CLASS_EMOJIS: {
    commander: '🧭',
    artillery: '💥',
    infantry: '🪖',
    recon: '🎯',
    tank: '🛡️',
    streamer: '📺'
  },

  REQUIRED_ROLES_FOR_EVENT: ['Team Rep', 'Streamer'],

  ADMIN_ACTIONS: [
    'admin_reset',
    'admin_reload',
    'admin_clearlogs',
  ],

  COLORS: {
    ALLIES: 0x3498db,
    AXIS: 0xe74c3c,
    SUCCESS: 0x2ecc71,
    ERROR: 0xe74c3c,
    WARNING: 0xf39c12,
    INFO: [1, 19, 39],
    PRIMARY: '#0099FF'
  },

  REQUIRED_ENV_VARS: [
    'TOKEN',
    'CLIENT_ID',
    'GUILD_ID',
    'CHANNEL_ID',
    'ALLIES_ROLE',
    'AXIS_ROLE',
    'ADMIN_LOG_CHANNEL',
    'MAIN_GUILD_ID',
    'MONGO_URI'
  ]
};
