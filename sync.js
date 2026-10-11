/**
 * REALTIME DATABASE & SYNC ENGINE - FREE FIRE SCOREBOARD & SPONSORS
 * Mendukung:
 * 1. Server API & Realtime Server-Sent Events (SSE) di http://localhost:3000/api/events (0ms ke OBS & Chrome!)
 * 2. BroadcastChannel API: Latensi 0ms antar tab/jendela
 * 3. LocalStorage & Disk Storage (tournament_data.json)
 * 4. Free Public Cloud WebSocket Relay: Sinkronisasi instan lintas perangkat (HP <-> PC / Vercel Deploy)
 */

class ScoreSyncEngine {
  constructor() {
    this.channelName = 'ff_scoreboard_itfest_channel';
    this.storageKey = 'ff_scoreboard_data_v1';
    this.settingsKey = 'ff_scoreboard_settings_v1';
    this.sponsorsKey = 'ff_scoreboard_sponsors_v1';
    this.metaKey = 'ff_scoreboard_last_meta';
    
    // Cloud Room Topic (Free, enterprise-grade, retained storage on public MQTT brokers)
    this.cloudTopic = 'ff_itfest_tourney_sync_2026/live_db';
    
    this.subscribers = new Set();
    this.broadcastChannel = null;
    this.mqttClient = null;
    this.sseSource = null;
    this.isCloudConnected = false;
    this.isServerConnected = false;
    this.lastTimestamp = 0;
    this.engineId = 'engine_' + Math.random().toString(36).substring(2, 9);

    // Resolve server base URL: Uses relative origin on Vercel/Web, no localhost dependency
    this.apiBaseUrl = (typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin.startsWith('http'))
      ? window.location.origin
      : '';

    this.initServerSync();
    this.initLocalChannel();
    this.initStorageListener();
    this.initCloudMqtt();
  }

  // 1. CONNECT TO VERCEL SERVERLESS API (/api/data)
  initServerSync() {
    if (!this.apiBaseUrl) return;
    const dataUrl = `${this.apiBaseUrl}/api/data`;

    if (typeof fetch !== 'undefined') {
      fetch(dataUrl)
        .then(res => {
          if (res.ok) return res.json();
          throw new Error('API not available');
        })
        .then(db => {
          if (db && (db.teams || db.sponsors)) {
            this.applyFullDatabase(db);
          }
        })
        .catch(() => {});
    }
  }

  // Apply complete state update
  applyFullDatabase(db) {
    if (db.teams && Array.isArray(db.teams)) {
      try { localStorage.setItem(this.storageKey, JSON.stringify(db.teams)); } catch (_) {}
    }
    if (db.sponsors && Array.isArray(db.sponsors)) {
      try { localStorage.setItem(this.sponsorsKey, JSON.stringify(db.sponsors)); } catch (_) {}
    }
    if (db.settings) {
      try { localStorage.setItem(this.settingsKey, JSON.stringify(db.settings)); } catch (_) {}
    }
    this.notifySubscribers({
      type: 'FULL_SYNC',
      teams: db.teams || this.getData(),
      sponsors: db.sponsors || this.getSponsors(),
      settings: db.settings || this.getSettings(),
      timestamp: db.timestamp || Date.now()
    });
  }

  // 2. LOCAL BROADCAST (0ms Latency on same browser)
  initLocalChannel() {
    if ('BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel(this.channelName);
        this.broadcastChannel.onmessage = (event) => {
          if (event && event.data) {
            this.handleIncomingPayload(event.data);
          }
        };
      } catch (e) {
        console.warn('BroadcastChannel error:', e);
      }
    }
  }

  // 3. STORAGE EVENT LISTENER
  initStorageListener() {
    window.addEventListener('storage', (event) => {
      if (event.key === this.storageKey || event.key === this.sponsorsKey || event.key === this.metaKey) {
        this.notifySubscribers({
          type: 'STORAGE_UPDATE',
          teams: this.getData(),
          sponsors: this.getSponsors(),
          settings: this.getSettings(),
          timestamp: Date.now()
        });
      }
    });
  }

  // 4. CLOUD MQTT SYNCHRONIZER (Works seamlessly on Vercel, OBS, and any device worldwide)
  initCloudMqtt() {
    if (typeof window === 'undefined') return;

    if (typeof Paho === 'undefined' || !Paho.MQTT || !Paho.MQTT.Client) {
      setTimeout(() => this.initCloudMqtt(), 800);
      return;
    }

    const brokers = [
      { host: 'broker.emqx.io', port: 8084, path: '/mqtt' },
      { host: 'broker.hivemq.com', port: 8884, path: '/mqtt' }
    ];

    const connectToBroker = (index) => {
      if (index >= brokers.length) {
        setTimeout(() => connectToBroker(0), 4000);
        return;
      }

      const b = brokers[index];
      const clientId = 'ff_c_' + Math.random().toString(36).substring(2, 9);

      try {
        this.mqttClient = new Paho.MQTT.Client(b.host, b.port, b.path, clientId);

        this.mqttClient.onConnectionLost = (resp) => {
          this.isCloudConnected = false;
          this.notifyStatus(false);
          setTimeout(() => connectToBroker((index + 1) % brokers.length), 3000);
        };

        this.mqttClient.onMessageArrived = (message) => {
          try {
            const payload = JSON.parse(message.payloadString);
            if (payload && payload.senderId !== this.engineId) {
              this.applyIncomingCloudPayload(payload);
            }
          } catch (_) {}
        };

        this.mqttClient.connect({
          useSSL: true,
          timeout: 5,
          keepAliveInterval: 45,
          cleanSession: true,
          onSuccess: () => {
            this.isCloudConnected = true;
            this.notifyStatus(true);
            try {
              this.mqttClient.subscribe(this.cloudTopic, { qos: 1 });
            } catch (_) {}
          },
          onFailure: () => {
            connectToBroker(index + 1);
          }
        });
      } catch (err) {
        connectToBroker(index + 1);
      }
    };

    connectToBroker(0);
  }

  applyIncomingCloudPayload(payload) {
    if (payload.teams && Array.isArray(payload.teams)) {
      try { localStorage.setItem(this.storageKey, JSON.stringify(payload.teams)); } catch (_) {}
    }
    if (payload.sponsors && Array.isArray(payload.sponsors)) {
      try { localStorage.setItem(this.sponsorsKey, JSON.stringify(payload.sponsors)); } catch (_) {}
    }
    if (payload.settings) {
      try { localStorage.setItem(this.settingsKey, JSON.stringify(payload.settings)); } catch (_) {}
    }
    this.handleIncomingPayload(payload);
  }

  sendToCloud(payload) {
    if (this.mqttClient && this.isCloudConnected) {
      try {
        const fullPayload = {
          teams: payload.teams || this.getData(),
          sponsors: payload.sponsors || this.getSponsors(),
          settings: payload.settings || this.getSettings(),
          senderId: payload.senderId || this.engineId,
          type: payload.type || 'SYNC',
          timestamp: payload.timestamp || Date.now()
        };
        const message = new Paho.MQTT.Message(JSON.stringify(fullPayload));
        message.destinationName = this.cloudTopic;
        message.qos = 1;
        message.retained = true; // RETAINED: Broker saves the state permanently so any newly opened OBS gets it instantly!
        this.mqttClient.send(message);
      } catch (e) {
        console.warn('MQTT send warning:', e);
      }
    }
  }

  sendToServer(payload) {
    if (typeof fetch !== 'undefined') {
      const dataUrl = `${this.apiBaseUrl}/api/data`;
      // Send complete snapshot to guarantee zero missing fields on server disk
      const fullSnapshot = {
        teams: payload.teams || this.getData(),
        sponsors: payload.sponsors || this.getSponsors(),
        settings: payload.settings || this.getSettings(),
        senderId: payload.senderId || this.engineId,
        type: payload.type || 'SYNC',
        timestamp: payload.timestamp || Date.now()
      };

      fetch(dataUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullSnapshot)
      })
      .then(res => {
        if (res.ok) {
          this.isServerConnected = true;
          this.notifyStatus(true);
        }
      })
      .catch((err) => {
        console.warn('sendToServer network warning:', err.message);
      });
    }
  }

  handleIncomingPayload(payload) {
    this.lastTimestamp = payload.timestamp || Date.now();
    this.notifySubscribers(payload);
  }

  notifyStatus(connected) {
    this.notifySubscribers({
      type: 'CLOUD_STATUS',
      connected: connected || this.isServerConnected || this.isCloudConnected
    });
  }

  onUpdate(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  notifySubscribers(payload) {
    this.subscribers.forEach((cb) => {
      try {
        cb(payload);
      } catch (err) {
        console.error('Callback error:', err);
      }
    });
  }

  // 12 TEAMS DEMO (Clean, no flags or country identity)
  getDefaultTeams() {
    return [
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
    ];
  }

  // DEFAULT SPONSOR LOGOS WITH 100% VALID ENCODED SVGS (Never broken!)
  getDefaultSponsors() {
    const kratingdaengRaw = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 60"><rect width="240" height="60" fill="#060920" rx="4"/><circle cx="120" cy="30" r="22" fill="#FFCC00"/><path d="M70 34c10-8 22-10 32-4-8-7-20-8-32 4zm100 0c-10-8-22-10-32-4 8-7 20-8 32 4z" fill="#CC0000"/><text x="120" y="52" font-family="Arial,sans-serif" font-weight="900" font-size="14" fill="#FFFFFF" text-anchor="middle" letter-spacing="2">KRATINGDAENG</text></svg>`;
    const itFestRaw = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 60"><rect width="240" height="60" fill="#060920" rx="4"/><path d="M30 15h12v30H30zm20 0h30v8H62v3h14v8H62v11H50z" fill="#00F0FF"/><text x="135" y="38" font-family="'Courier New',monospace" font-weight="bold" font-size="20" fill="#FFE600" letter-spacing="1">IT-FEST 2026</text></svg>`;
    const garenaRaw = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 60"><rect width="240" height="60" fill="#060920" rx="4"/><polygon points="35,12 55,30 35,48 45,30" fill="#FF3300"/><text x="140" y="38" font-family="Impact,sans-serif" font-size="22" fill="#FFFFFF" letter-spacing="2">FREE FIRE</text></svg>`;

    return [
      {
        id: 'spon-1',
        name: 'Kratingdaeng',
        category: 'OFFICIAL ENERGY DRINK PARTNER',
        imageUrl: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(kratingdaengRaw)
      },
      {
        id: 'spon-2',
        name: 'IT-Festival 2026',
        category: 'ORGANIZED BY IT-FESTIVAL',
        imageUrl: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(itFestRaw)
      },
      {
        id: 'spon-3',
        name: 'Free Fire Esports',
        category: 'OFFICIAL ESPORTS TITLE',
        imageUrl: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(garenaRaw)
      }
    ];
  }

  getDefaultSettings() {
    return {
      tournamentName: 'IT-FESTIVAL 2026 FREE FIRE CHAMPIONSHIP',
      subtitle: 'OFFICIAL ESPORTS TOURNAMENT • STAGE FINALS',
      championRushThreshold: 118,
      championRushEnabled: true,
      formulaMode: 'official',
      booyahBonusPoints: 0,
      soundEnabled: true,
      sponsorIntervalSeconds: 3.5
    };
  }

  getData() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) {
        const initial = this.getDefaultTeams();
        this.saveData(initial, false);
        return initial;
      }
      return JSON.parse(raw);
    } catch (_) {
      return this.getDefaultTeams();
    }
  }

  getSettings() {
    try {
      const raw = localStorage.getItem(this.settingsKey);
      if (!raw) {
        const def = this.getDefaultSettings();
        this.saveSettings(def, false);
        return def;
      }
      return { ...this.getDefaultSettings(), ...JSON.parse(raw) };
    } catch (_) {
      return this.getDefaultSettings();
    }
  }

  getSponsors() {
    try {
      const raw = localStorage.getItem(this.sponsorsKey);
      if (!raw) {
        const def = this.getDefaultSponsors();
        this.saveSponsors(def, false);
        return def;
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        return this.getDefaultSponsors();
      }
      return parsed;
    } catch (_) {
      return this.getDefaultSponsors();
    }
  }

  calculateTotal(team, settings = null) {
    const s = settings || this.getSettings();
    const elims = parseInt(team.elims || 0, 10);
    const placement = parseInt(team.placementPts || 0, 10);
    const booyah = parseInt(team.booyah || 0, 10);
    
    if (s.formulaMode === 'custom_bonus' && s.booyahBonusPoints > 0) {
      return elims + placement + (booyah * s.booyahBonusPoints);
    }
    return elims + placement;
  }

  saveData(teams, broadcast = true, senderId = null) {
    const settings = this.getSettings();
    const updatedTeams = teams.map(t => ({
      ...t,
      total: this.calculateTotal(t, settings)
    }));

    const now = Date.now();
    this.lastTimestamp = now;

    try {
      localStorage.setItem(this.storageKey, JSON.stringify(updatedTeams));
      localStorage.setItem(this.metaKey, JSON.stringify({ timestamp: now, senderId: senderId || this.engineId }));
    } catch (e) {
      console.warn('LocalStorage quota warning:', e);
    }

    if (broadcast) {
      const payload = {
        type: 'SCORE_UPDATE',
        teams: updatedTeams,
        settings: settings,
        senderId: senderId || this.engineId,
        timestamp: now
      };
      
      if (this.broadcastChannel) {
        this.broadcastChannel.postMessage(payload);
      }
      this.notifySubscribers(payload);
      this.sendToServer(payload);
      this.sendToCloud(payload);
    }

    return updatedTeams;
  }

  saveSettings(settings, broadcast = true, senderId = null) {
    const now = Date.now();
    this.lastTimestamp = now;

    try {
      localStorage.setItem(this.settingsKey, JSON.stringify(settings));
      localStorage.setItem(this.metaKey, JSON.stringify({ timestamp: now, senderId: senderId || this.engineId }));
    } catch (_) {}

    const teams = this.getData();
    this.saveData(teams, broadcast, senderId);

    if (broadcast) {
      const payload = {
        type: 'SETTINGS_UPDATE',
        settings: settings,
        teams: this.getData(),
        senderId: senderId || this.engineId,
        timestamp: now
      };
      if (this.broadcastChannel) {
        this.broadcastChannel.postMessage(payload);
      }
      this.notifySubscribers(payload);
      this.sendToServer(payload);
      this.sendToCloud(payload);
    }
  }

  saveSponsors(sponsors, broadcast = true, senderId = null) {
    const now = Date.now();
    this.lastTimestamp = now;

    try {
      localStorage.setItem(this.sponsorsKey, JSON.stringify(sponsors));
      localStorage.setItem(this.metaKey, JSON.stringify({ timestamp: now, senderId: senderId || this.engineId }));
    } catch (e) {
      console.warn('LocalStorage quota on sponsors:', e);
    }

    if (broadcast) {
      const payload = {
        type: 'SPONSORS_UPDATE',
        sponsors: sponsors,
        senderId: senderId || this.engineId,
        timestamp: now
      };
      if (this.broadcastChannel) {
        this.broadcastChannel.postMessage(payload);
      }
      this.notifySubscribers(payload);
      this.sendToServer(payload);
      this.sendToCloud(payload);
    }
    return sponsors;
  }
}

// Global singleton instance
window.syncEngine = new ScoreSyncEngine();
