/**
 * rotationStore.js
 *
 * Persists raw (human-readable) Map Rotation event lines to disk so that
 * the Edit Rotation modal can round-trip correctly.
 *
 * When a rotation is saved the raw input (e.g. "01/04/2026 - Utah") is stored
 * here keyed by Discord message ID. When the admin opens Edit Rotation we load
 * the raw text instead of reading back the rendered <t:unix:F> timestamps from
 * the embed, which cannot be converted back to editable dates.
 */

const fs   = require('fs');
const path = require('path');

const STORE_PATH = path.join(process.cwd(), 'data', 'rotation_raw.json');

function _read() {
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch (_) {
    return {};
  }
}

function _write(store) {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
}

/**
 * Save raw event text for a given message ID.
 * @param {string} messageId
 * @param {{ month1Header, month1Events, month2Header, month2Events }} data
 */
function saveRotationRaw(messageId, data) {
  const store = _read();
  store[messageId] = data;
  _write(store);
}

/**
 * Load raw event text for a given message ID.
 * Returns null if not found (e.g. embed was posted before this fix was deployed).
 * @param {string} messageId
 * @returns {{ month1Header, month1Events, month2Header, month2Events } | null}
 */
function loadRotationRaw(messageId) {
  const store = _read();
  return store[messageId] ?? null;
}

module.exports = { saveRotationRaw, loadRotationRaw };
