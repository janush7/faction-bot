/**
 * rotationStore.js
 *
 * Persists:
 *  1. Raw (human-readable) Map Rotation event lines keyed by message ID,
 *     so the Edit Rotation modal can round-trip correctly.
 *  2. The rotation message ID per channel, so the bot can locate the
 *     rotation message without scanning channel history.
 */

const fs   = require('fs');
const path = require('path');

const RAW_PATH = path.join(process.cwd(), 'data', 'rotation_raw.json');
const MSG_PATH = path.join(process.cwd(), 'data', 'rotation_msg.json');

function _read(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return {};
  }
}

function _write(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// ── Raw event text (for edit round-trip) ─────────────────────────────────────

function saveRotationRaw(messageId, data) {
  const store = _read(RAW_PATH);
  store[messageId] = data;
  _write(RAW_PATH, store);
}

function loadRotationRaw(messageId) {
  return _read(RAW_PATH)[messageId] ?? null;
}

// ── Message ID per channel (so we can fetch it directly) ─────────────────────

function saveRotationMsgId(channelId, messageId) {
  const store = _read(MSG_PATH);
  store[channelId] = messageId;
  _write(MSG_PATH, store);
}

function loadRotationMsgId(channelId) {
  return _read(MSG_PATH)[channelId] ?? null;
}

module.exports = { saveRotationRaw, loadRotationRaw, saveRotationMsgId, loadRotationMsgId };
