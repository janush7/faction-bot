module.exports = {
  FACTIONS: {
    ALLIES: 'allies',
    AXIS: 'axis'
  },

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
  ]
};
