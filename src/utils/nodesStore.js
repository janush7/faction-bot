/**
 * nodesStore.js
 *
 * Persists NODES embed data in /tmp/ (always writable in Docker).
 * Prevents the 3-second Discord modal timeout by caching data locally
 * instead of making async API calls before showing the edit modal.
 */

const fs = require('fs');

const DATA_PATH = '/tmp/nodes_data.json';

function saveNodesData(fields) {
  try {
    fs.writeFileSync(DATA_PATH, JSON.stringify(fields, null, 2), 'utf8');
  } catch (_) {}
}

function loadNodesData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  } catch (_) {
    return null;
  }
}

module.exports = { saveNodesData, loadNodesData };
