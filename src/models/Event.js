const mongoose = require('mongoose');

const classSchema = new mongoose.Schema({
  limit: { type: Number, required: true },
  members: { type: [String], default: [] }, // user IDs zapisanych
  queue: { type: [String], default: [] }    // user IDs w kolejce
});

const eventSchema = new mongoose.Schema({
  eventId: { type: String, required: true },      // unikalny ID eventu
  messageId: { type: String, required: true },    // ID wiadomości z embedem
  channelId: { type: String, required: true },    // kanał eventu
  createdBy: { type: String, required: true },    // ID autora eventu
  createdAt: { type: Date, default: Date.now },

  classes: {
    commander: { type: classSchema, required: true },
    infantry: { type: classSchema, required: true },
    tank: { type: classSchema, required: true },
    recon: { type: classSchema, required: true },
    artillery: { type: classSchema, required: true },
    streamer: { type: classSchema, required: true }
  }
});

module.exports = mongoose.model('Event', eventSchema);
