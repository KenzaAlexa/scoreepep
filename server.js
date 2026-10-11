const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'tournament_data.json');

// MIME types
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Default tournament data
function getDefaultData() {
  const kratingdaengSvg = `data:image/svg+xml;charset=utf-8,` + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 60"><rect width="240" height="60" fill="#060920" rx="4"/><circle cx="120" cy="30" r="22" fill="#FFCC00"/><path d="M70 34c10-8 22-10 32-4-8-7-20-8-32 4zm100 0c-10-8-22-10-32-4 8-7 20-8 32 4z" fill="#CC0000"/><text x="120" y="52" font-family="Arial,sans-serif" font-weight="900" font-size="14" fill="#FFFFFF" text-anchor="middle" letter-spacing="2">KRATINGDAENG</text></svg>`);
  const itFestSvg = `data:image/svg+xml;charset=utf-8,` + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 60"><rect width="240" height="60" fill="#060920" rx="4"/><path d="M30 15h12v30H30zm20 0h30v8H62v3h14v8H62v11H50z" fill="#00F0FF"/><text x="135" y="38" font-family="'Courier New',monospace" font-weight="bold" font-size="20" fill="#FFE600" letter-spacing="1">IT-FEST 2026</text></svg>`);
  const garenaSvg = `data:image/svg+xml;charset=utf-8,` + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 60"><rect width="240" height="60" fill="#060920" rx="4"/><polygon points="35,12 55,30 35,48 45,30" fill="#FF3300"/><text x="140" y="38" font-family="Impact,sans-serif" font-size="22" fill="#FFFFFF" letter-spacing="2">FREE FIRE</text></svg>`);

  return {
    teams: [
      { id: 'team-1', name: 'AGAL', tag: 'AGAL', booyah: 1, elims: 33, placementPts: 21, total: 54, logoText: 'AG' },
      { id: 'team-2', name: 'ONIC ESPORTS', tag: 'ONIC', booyah: 0, elims: 28, placementPts: 23, total: 51, logoText: 'ON' },
      { id: 'team-3', name: 'FLASH', tag: 'FL', booyah: 0, elims: 36, placementPts: 7, total: 43, logoText: 'FL' },
      { id: 'team-4', name: 'BURIRAM UNITED', tag: 'BRU', booyah: 1, elims: 22, placementPts: 18, total: 40, logoText: 'BR' },
      { id: 'team-5', name: 'BIGETRON BY VITALITY', tag: 'BTR', booyah: 1, elims: 21, placementPts: 20, total: 41, logoText: 'BT' },
      { id: 'team-6', name: 'GOW ESPORTS', tag: 'GOW', booyah: 0, elims: 20, placementPts: 18, total: 38, logoText: 'GW' },
      { id: 'team-7', name: 'RRQ KAZU', tag: 'RRQ', booyah: 0, elims: 27, placementPts: 10, total: 37, logoText: 'RQ' },
      { id: 'team-8', name: 'P ESPORTS', tag: 'PE', booyah: 0, elims: 16, placementPts: 20, total: 36, logoText: 'PE' },
      { id: 'team-9', name: 'MBR GAMING', tag: 'MBR', booyah: 0, elims: 18, placementPts: 9, total: 27, logoText: 'MB' },
      { id: 'team-10', name: 'WAG ESPORTS', tag: 'WAG', booyah: 0, elims: 16, placementPts: 18, total: 34, logoText: 'WG' },
      { id: 'team-11', name: 'FALCONS', tag: 'FLCN', booyah: 0, elims: 16, placementPts: 11, total: 27, logoText: 'FC' },
      { id: 'team-12', name: 'TWISTED MINDS', tag: 'TWIS', booyah: 0, elims: 6, placementPts: 6, total: 12, logoText: 'TW' }
    ],
    sponsors: [
      { id: 'spon-1', name: 'Kratingdaeng', category: 'OFFICIAL ENERGY DRINK PARTNER', imageUrl: kratingdaengSvg },
      { id: 'spon-2', name: 'IT-Festival 2026', category: 'ORGANIZED BY IT-FESTIVAL', imageUrl: itFestSvg },
      { id: 'spon-3', name: 'Free Fire Esports', category: 'OFFICIAL ESPORTS TITLE', imageUrl: garenaSvg }
    ],
    settings: {
      tournamentName: 'IT-FESTIVAL 2026 FREE FIRE CHAMPIONSHIP',
      subtitle: 'OFFICIAL ESPORTS TOURNAMENT • STAGE FINALS',
      championRushThreshold: 118,
      championRushEnabled: true,
      formulaMode: 'official',
      booyahBonusPoints: 0,
      soundEnabled: true,
      sponsorIntervalSeconds: 3.5
    },
    timestamp: Date.now()
  };
}

// Ensure database file exists
function loadDatabase() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, 'utf8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error('Error reading database file:', err);
  }
  const initial = getDefaultData();
  saveDatabase(initial);
  return initial;
}

function saveDatabase(data) {
  try {
    data.timestamp = Date.now();
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving database file:', err);
  }
}

// Active Server-Sent Events subscribers
const sseClients = new Set();

function broadcastSSE(data) {
  const message = `data: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach((client) => {
    try {
      client.write(message);
    } catch (_) {
      sseClients.delete(client);
    }
  });
}

// Initialize on start
let currentDb = loadDatabase();

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // 1. API: GET /api/data
  if (req.method === 'GET' && pathname === '/api/data') {
    currentDb = loadDatabase();
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });
    res.end(JSON.stringify(currentDb));
    return;
  }

  // 2. API: POST /api/data (Save & Broadcast)
  if (req.method === 'POST' && pathname === '/api/data') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        if (payload.teams) currentDb.teams = payload.teams;
        if (payload.sponsors) currentDb.sponsors = payload.sponsors;
        if (payload.settings) currentDb.settings = payload.settings;
        currentDb.timestamp = Date.now();
        currentDb.senderId = payload.senderId || 'server';

        saveDatabase(currentDb);
        broadcastSSE(currentDb);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', timestamp: currentDb.timestamp }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // 3. API: GET /api/events (Server-Sent Events Realtime Stream)
  if (req.method === 'GET' && pathname === '/api/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive'
    });
    res.write(`data: ${JSON.stringify(currentDb)}\n\n`);
    sseClients.add(res);

    req.on('close', () => {
      sseClients.delete(res);
    });
    return;
  }

  // 4. Static file serving (with NO-CACHE for development / live scoreboard)
  let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`⚡ FREE FIRE REALTIME DATABASE SERVER running on http://localhost:${PORT}`);
  console.log(`📁 Database file: ${DATA_FILE}`);
});
