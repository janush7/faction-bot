const mongoose = require('mongoose');

// Schema for individual class data
const classSchema = new mongoose.Schema({
  limit: { type: Number, required: true },
  members: [{ type: String }],  // Array of user IDs accepted
  queue: [{ type: String }]     // Array of user IDs in queue
});

// Main event schema
const eventSchema = new mongoose.Schema({
  eventId: { 
    type: String, 
    required: true, 
    unique: true,
    index: true 
  },
  messageId: { type: String, required: true },
  channelId: { type: String, required: true },
  guildId: { type: String, required: true },
  createdBy: { type: String, required: true },
  eventName: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now },

  // All class data with limits
  classes: {
    commander: { 
      type: classSchema,
      default: { limit: 2, members: [], queue: [] }
    },
    artillery: { 
      type: classSchema,
      default: { limit: 2, members: [], queue: [] }
    },
    infantry: { 
      type: classSchema,
      default: { limit: 12, members: [], queue: [] }
    },
    recon: { 
      type: classSchema,
      default: { limit: 2, members: [], queue: [] }
    },
    tank: { 
      type: classSchema,
      default: { limit: 6, members: [], queue: [] }
    },
    streamer: { 
      type: classSchema,
      default: { limit: 1, members: [], queue: [] }
    }
  }
});

// Automatically update 'updatedAt' before saving
eventSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Event', eventSchema);
