const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const DATA_DIR = path.join(__dirname, '../../data');
const EVENTS_FILE = path.join(DATA_DIR, 'events.json');

/** In-memory event map: { [eventId]: eventObject } */
let events = {};

/** Load events from disk on startup */
function load() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(EVENTS_FILE)) return;
    const raw = fs.readFileSync(EVENTS_FILE, 'utf8');
    events = JSON.parse(raw);
    logger.info(`Loaded ${Object.keys(events).length} event(s) from disk`);
  } catch (err) {
    logger.error('Failed to load events from disk:', err);
    events = {};
  }
}

/** Write current in-memory state to disk */
function persist() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(EVENTS_FILE, JSON.stringify(events, null, 2), 'utf8');
  } catch (err) {
    logger.error('Failed to save events to disk:', err);
  }
}

/** Generate a short unique event ID */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}

/**
 * Create a new event and persist it.
 * Returns the created event object (a live reference).
 */
function create({ title, description, date, maxParticipants, createdBy, guildId }) {
  const eventId = generateId();
  const now = new Date().toISOString();
  const event = {
    eventId,
    messageId: null,
    channelId: null,
    guildId,
    createdBy,
    title,
    description,
    date,
    maxParticipants,
    createdAt: now,
    updatedAt: now,
    classes: {
      commander: { limit: 2,  members: [], queue: [] },
      artillery: { limit: 2,  members: [], queue: [] },
      infantry:  { limit: 12, members: [], queue: [] },
      recon:     { limit: 2,  members: [], queue: [] },
      tank:      { limit: 6,  members: [], queue: [] },
      streamer:  { limit: 1,  members: [], queue: [] },
    },
  };
  events[eventId] = event;
  persist();
  return event;
}

/**
 * Find an event by its ID.
 * Returns a live reference — mutate it then call persist().
 */
function findById(eventId) {
  return events[eventId] || null;
}

/** Delete an event by ID and persist. Returns the deleted event or null. */
function remove(eventId) {
  const event = events[eventId];
  if (!event) return null;
  delete events[eventId];
  persist();
  return event;
}

/** Return all events as an array */
function getAll() {
  return Object.values(events);
}

// Load persisted events on startup
load();

module.exports = { create, findById, remove, getAll, persist };
