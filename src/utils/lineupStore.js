/**
 * lineupStore.js
 *
 * Persists lineup caption and server details data in /app/data/
 * (Docker named volume — survives restarts).
 * Prevents the 3-second Discord modal timeout by caching data locally
 * instead of scanning channels before showing the edit modal.
 */

const fs   = require('fs');
const path = require('path');

const DATA_DIR    = '/app/data';
const LINEUP_PATH = path.join(DATA_DIR, 'lineup_data.json');
const SERVER_PATH = path.join(DATA_DIR, 'server_data.json');

function _read(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return {};
  }
}

function _write(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (_) {}
}

// ── Lineup caption cache ─────────────────────────────────────────────────────

function saveLineupData(channelId, messageId, caption) {
  const store = _read(LINEUP_PATH);
  store[channelId] = { messageId, caption };
  _write(LINEUP_PATH, store);
}

function loadLineupData(channelId) {
  return _read(LINEUP_PATH)[channelId] ?? null;
}

// ── Server details cache ──────────────────────────────────────────────────────

function saveServerData(channelId, messageId, serverName, serverPassword) {
  const store = _read(SERVER_PATH);
  store[channelId] = { messageId, serverName, serverPassword };
  _write(SERVER_PATH, store);
}

function loadServerData(channelId) {
  return _read(SERVER_PATH)[channelId] ?? null;
}

module.exports = { saveLineupData, loadLineupData, saveServerData, loadServerData };
