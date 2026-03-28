const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join('/app', 'data');
const TIMES_FILE = path.join(DATA_DIR, 'times.json');

const DEFAULTS = {
  matchPositions: '19:30',
  slBriefing: '19:30',
  gameStart: '20:00',
};

function getTimes() {
  try {
    if (fs.existsSync(TIMES_FILE)) {
      const raw = fs.readFileSync(TIMES_FILE, 'utf8');
      return { ...DEFAULTS, ...JSON.parse(raw) };
    }
  } catch {}
  return { ...DEFAULTS };
}

function saveTimes(times) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(TIMES_FILE, JSON.stringify(times, null, 2), 'utf8');
}

module.exports = { getTimes, saveTimes };
