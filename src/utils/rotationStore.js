/**
 * rotationStore.js
 *
 * Persists rotation data in /tmp/ (always writable in Docker).
 * Data is lost on container restart, but the bot will scan the channel
 * to recover the message ID if needed.
 */

const fs   = require('fs');
const path = require('path');

const RAW_PATH = '/tmp/rotation_raw.json';
const MSG_PATH = '/tmp/rotation_msg.json';

function _read(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return {};
  }
}

function _write(filePath, data) {
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

// ── Message ID per channel ────────────────────────────────────────────────────

function saveRotationMsgId(channelId, messageId) {
  const store = _read(MSG_PATH);
  store[channelId] = messageId;
  _write(MSG_PATH, store);
}

function loadRotationMsgId(channelId) {
  return _read(MSG_PATH)[channelId] ?? null;
}

module.exports = { saveRotationRaw, loadRotationRaw, saveRotationMsgId, loadRotationMsgId };
