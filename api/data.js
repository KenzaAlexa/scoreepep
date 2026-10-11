// Vercel Serverless Function: /api/data
const fs = require('fs');
const path = require('path');

let memoryDb = null;

function getInitialDb() {
  try {
    const filePath = path.join(process.cwd(), 'tournament_data.json');
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Fallback reading tournament_data.json:', e);
  }
  return {
    teams: [
      { id: "team-1", name: "RRQ KAZU", tag: "RRQ", logoText: "RR", booyah: 0, elims: 0, placementPts: 0, total: 0 }
    ],
    sponsors: [],
    settings: {
      tournamentName: "IT-FESTIVAL 2026 FREE FIRE CHAMPIONSHIP",
      subtitle: "OFFICIAL ESPORTS TOURNAMENT • STAGE FINALS",
      championRushThreshold: 118,
      championRushEnabled: true,
      formulaMode: "official",
      booyahBonusPoints: 0,
      soundEnabled: true,
      sponsorIntervalSeconds: 3.5
    },
    timestamp: Date.now()
  };
}

module.exports = function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method === 'POST') {
    try {
      const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!memoryDb) memoryDb = getInitialDb();
      if (payload.teams) memoryDb.teams = payload.teams;
      if (payload.sponsors) memoryDb.sponsors = payload.sponsors;
      if (payload.settings) memoryDb.settings = payload.settings;
      memoryDb.timestamp = Date.now();
      memoryDb.senderId = payload.senderId || 'vercel';
      return res.status(200).json({ status: 'ok', timestamp: memoryDb.timestamp });
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
  }

  // GET
  if (!memoryDb) {
    memoryDb = getInitialDb();
  }

  return res.status(200).json(memoryDb);
};
