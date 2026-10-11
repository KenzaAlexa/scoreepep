/**
 * ADMIN CONTROLLER (admin.js)
 * Enhanced:
 * - Fixes scroll jump / refresh bug (Does not destroy DOM or steal focus while typing)
 * - Auto-save inputs directly under each team
 * - Sponsor Management (Upload logo / URL, live carousel sync, delete, reset)
 * - 0ms Real-Time broadcast to Scoreboard
 */

class AdminController {
  constructor() {
    this.adminId = 'admin_' + Math.random().toString(36).substring(2, 9);
    this.teams = [];
    this.sponsors = [];
    this.settings = {};

    this.container = document.getElementById('teams-manage-container');
    this.totalCountEl = document.getElementById('total-teams-count');
    this.addForm = document.getElementById('add-team-form');
    this.sponsorForm = document.getElementById('add-sponsor-form');
    this.sponsorsContainer = document.getElementById('sponsors-list-container');

    this.init();
  }

  init() {
    this.loadData();
    this.setupEvents();
    this.setupSyncListener();
  }

  loadData() {
    this.teams = window.syncEngine.getData();
    this.sponsors = window.syncEngine.getSponsors();
    this.settings = window.syncEngine.getSettings();
    this.renderTeams();
    this.renderSponsors();
  }

  setupSyncListener() {
    window.syncEngine.onUpdate((payload) => {
      // Update cloud DB status badge
      if (payload && payload.type === 'CLOUD_STATUS') {
        const statusEl = document.getElementById('db-status-badge');
        if (statusEl) {
          if (payload.connected) {
            statusEl.innerHTML = '🟢 REALTIME CLOUD: AKTIF (ONLINE)';
            statusEl.style.color = '#00FF88';
          } else {
            statusEl.innerHTML = '🟡 MENYAMBUNGKAN KE CLOUD...';
            statusEl.style.color = 'var(--yellow)';
          }
        }
      }

      // 1. Ignore updates that originated from this admin instance (Prevents scroll & focus jumping!)
      if (payload && payload.senderId === this.adminId) {
        return;
      }

      // 2. Handle sponsor updates
      if (payload && (payload.type === 'SPONSORS_UPDATE' || payload.sponsors)) {
        this.sponsors = window.syncEngine.getSponsors();
        this.renderSponsors();
      }

      // 3. Handle external teams updates
      if (payload && payload.teams) {
        const activeEl = document.activeElement;
        const isTyping = activeEl && activeEl.tagName === 'INPUT';
        
        if (!isTyping) {
          this.teams = payload.teams;
          this.renderTeams();
        } else {
          this.teams = payload.teams;
        }
      }
    });
  }

  showToast(message, duration = 3500) {
    const box = document.getElementById('admin-toast-box');
    if (!box) return;
    box.textContent = message;
    box.classList.add('show');
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      box.classList.remove('show');
    }, duration);
  }

  compressImage(file, maxWidth, maxHeight, callback) {
    // If SVG, do not canvas rasterize (keeps crisp vector quality and avoids blank canvas)
    if (file.type === 'image/svg+xml') {
      const reader = new FileReader();
      reader.onload = (e) => callback(e.target.result);
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width;
        let h = img.height;
        const ratio = Math.min(maxWidth / w, maxHeight / h, 1);
        w = Math.max(1, Math.round(w * ratio));
        h = Math.max(1, Math.round(h * ratio));
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        callback(canvas.toDataURL('image/png'));
      };
      img.onerror = () => callback(e.target.result);
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  // ---------------- SPONSOR MANAGEMENT ----------------
  handleAddSponsor() {
    const nameInput = document.getElementById('sponsor-name-input');
    const catInput = document.getElementById('sponsor-cat-input');
    const fileInput = document.getElementById('sponsor-file-input');
    const urlInput = document.getElementById('sponsor-url-input');
    const previewBox = document.getElementById('sponsor-preview-box');

    const name = nameInput.value.trim();
    const category = catInput.value.trim().toUpperCase() || 'OFFICIAL SPONSOR';

    if (!name) return;

    const finalizeAdd = (imageUrl) => {
      const newSponsor = {
        id: 'spon-' + Date.now(),
        name: name,
        category: category,
        imageUrl: imageUrl
      };

      this.sponsors.push(newSponsor);
      window.syncEngine.saveSponsors(this.sponsors, true, this.adminId);

      nameInput.value = '';
      if (fileInput) fileInput.value = '';
      if (urlInput) urlInput.value = '';
      if (previewBox) previewBox.style.display = 'none';

      this.renderSponsors();
      this.showToast(`✅ Sponsor "${newSponsor.name}" berhasil ditambahkan & langsung tampil di Scoreboard!`);
    };

    // If file chosen, auto compress via canvas to avoid quota limits
    if (fileInput && fileInput.files && fileInput.files[0]) {
      const file = fileInput.files[0];
      this.compressImage(file, 280, 70, (compressedDataUrl) => {
        finalizeAdd(compressedDataUrl);
      });
    } else if (urlInput && urlInput.value.trim()) {
      finalizeAdd(urlInput.value.trim());
    } else {
      // Create SVG logo badge with sponsor name
      const fallbackSvg = `data:image/svg+xml;charset=utf-8,` + encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 60"><rect width="240" height="60" fill="#060920" rx="4" stroke="#FFE600" stroke-width="2"/><text x="120" y="38" font-family="'Chakra Petch',Arial,sans-serif" font-weight="900" font-size="18" fill="#FFE600" text-anchor="middle" letter-spacing="2">${name.toUpperCase()}</text></svg>`
      );
      finalizeAdd(fallbackSvg);
    }
  }

  setupEvents() {
    // Configure "BUKA SCOREBOARD LIVE" button dynamically
    const openBoardBtn = document.getElementById('btn-open-scoreboard');
    if (openBoardBtn) {
      openBoardBtn.href = 'index.html';
    }

    // Sponsor Live Preview Box
    const fileInput = document.getElementById('sponsor-file-input');
    const urlInput = document.getElementById('sponsor-url-input');
    const previewBox = document.getElementById('sponsor-preview-box');
    const previewImg = document.getElementById('sponsor-preview-img');

    if (fileInput && previewBox && previewImg) {
      fileInput.addEventListener('change', () => {
        if (fileInput.files && fileInput.files[0]) {
          const file = fileInput.files[0];
          const r = new FileReader();
          r.onload = (e) => {
            previewImg.src = e.target.result;
            previewBox.style.display = 'block';
          };
          r.readAsDataURL(file);
        }
      });
    }

    if (urlInput && previewBox && previewImg) {
      urlInput.addEventListener('input', () => {
        const val = urlInput.value.trim();
        if (val) {
          previewImg.src = val;
          previewBox.style.display = 'block';
        } else if (!fileInput || !fileInput.files || !fileInput.files.length) {
          previewBox.style.display = 'none';
        }
      });
    }

    // Add new team (Only Name and Tag)
    this.addForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const nameInput = document.getElementById('new-team-name');
      const tagInput = document.getElementById('new-team-tag');

      const name = nameInput.value.trim();
      const tag = tagInput.value.trim().toUpperCase();

      if (!name || !tag) return;

      const newTeam = {
        id: 'team-' + Date.now(),
        name: name,
        tag: tag,
        logoText: tag.substring(0, 2),
        booyah: 0,
        elims: 0,
        placementPts: 0,
        total: 0
      };

      this.teams.push(newTeam);
      window.syncEngine.saveData(this.teams, true, this.adminId);

      nameInput.value = '';
      tagInput.value = '';
      this.renderTeams();

      this.showToast(`✅ Tim "${newTeam.name}" berhasil ditambahkan ke Scoreboard! (Peringkat #${this.teams.length}, 0 PTS - Silakan isi skor di kartu tim)`);

      setTimeout(() => {
        const el = document.getElementById(`manage-card-${newTeam.id}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    });

    // Add new sponsor
    if (this.sponsorForm) {
      this.sponsorForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleAddSponsor();
      });
    }

    // Reset sponsors to default
    const resetSponBtn = document.getElementById('btn-reset-sponsors');
    if (resetSponBtn) {
      resetSponBtn.addEventListener('click', () => {
        if (confirm('Kembalikan logo sponsor ke default (Kratingdaeng, IT-Fest, Free Fire)?')) {
          this.sponsors = window.syncEngine.getDefaultSponsors();
          window.syncEngine.saveSponsors(this.sponsors, true, this.adminId);
          this.renderSponsors();
          this.showToast('✓ Logo sponsor direset ke data awal');
        }
      });
    }

    // Reset teams to official demo data
    document.getElementById('btn-reset-demo').addEventListener('click', () => {
      if (confirm('Yakin ingin mereset seluruh data tim ke data resmi demo Free Fire SEA?')) {
        const def = window.syncEngine.getDefaultTeams();
        window.syncEngine.saveData(def, true, this.adminId);
        this.teams = def;
        this.renderTeams();
        this.showToast('✓ Seluruh data tim direset ke 12 tim demo resmi');
      }
    });
  }

  // Calculate total points with current rule
  calculateTeamTotal(team) {
    const elims = parseInt(team.elims || 0, 10);
    const placement = parseInt(team.placementPts || 0, 10);
    const booyah = parseInt(team.booyah || 0, 10);

    if (this.settings.formulaMode === 'custom_bonus' && this.settings.booyahBonusPoints > 0) {
      return elims + placement + (booyah * this.settings.booyahBonusPoints);
    }
    return elims + placement;
  }

  // AUTO-SAVE HANDLER: Triggers instantly without DOM re-render or losing focus!
  updateTeamScoreAutoSave(teamId, field, value) {
    const team = this.teams.find(t => t.id === teamId);
    if (!team) return;

    const intVal = Math.max(0, parseInt(value || 0, 10));
    team[field] = intVal;
    team.total = this.calculateTeamTotal(team);

    // Update total pill on card without re-rendering entire list (keeps focus & scroll intact!)
    const totalDisplay = document.getElementById(`total-display-${teamId}`);
    if (totalDisplay) {
      totalDisplay.textContent = team.total;
    }

    const saveBadge = document.getElementById(`save-badge-${teamId}`);
    if (saveBadge) {
      saveBadge.textContent = '⚡ Disinkronkan!';
      saveBadge.style.color = 'var(--yellow)';
      setTimeout(() => {
        if (saveBadge) {
          saveBadge.textContent = '✓ Tersimpan Otomatis';
          saveBadge.style.color = '#00FF88';
        }
      }, 700);
    }

    // Save and broadcast with this.adminId (prevents echo re-render!)
    window.syncEngine.saveData(this.teams, true, this.adminId);
  }

  stepField(teamId, field, delta) {
    const team = this.teams.find(t => t.id === teamId);
    if (!team) return;

    let current = parseInt(team[field] || 0, 10);
    current = Math.max(0, current + delta);

    const input = document.getElementById(`input-${field}-${teamId}`);
    if (input) input.value = current;

    this.updateTeamScoreAutoSave(teamId, field, current);
  }

  addQuickRankPts(teamId, rankPts, isBooyah) {
    const team = this.teams.find(t => t.id === teamId);
    if (!team) return;

    let curPlacement = parseInt(team.placementPts || 0, 10) + rankPts;
    team.placementPts = curPlacement;

    if (isBooyah) {
      team.booyah = (parseInt(team.booyah || 0, 10)) + 1;
      const bInput = document.getElementById(`input-booyah-${teamId}`);
      if (bInput) bInput.value = team.booyah;
    }

    const pInput = document.getElementById(`input-placementPts-${teamId}`);
    if (pInput) pInput.value = curPlacement;

    this.updateTeamScoreAutoSave(teamId, 'placementPts', curPlacement);
  }

  deleteTeam(teamId) {
    const team = this.teams.find(t => t.id === teamId);
    if (!team) return;
    if (confirm(`Hapus tim "${team.name}" dari turnamen?`)) {
      this.teams = this.teams.filter(t => t.id !== teamId);
      window.syncEngine.saveData(this.teams, true, this.adminId);
      this.renderTeams();
    }
  }

  renderTeams() {
    if (!this.container) return;
    this.totalCountEl.textContent = this.teams.length;
    this.container.innerHTML = '';

    const sorted = [...this.teams].sort((a, b) => b.total - a.total);

    sorted.forEach((team, idx) => {
      const card = document.createElement('div');
      card.className = 'team-manage-card';
      card.id = `manage-card-${team.id}`;

      card.innerHTML = `
        <!-- TEAM HEADER -->
        <div class="tmc-header">
          <div class="tmc-info">
            <span class="tmc-rank-tag">#${idx + 1}</span>
            <div>
              <span class="tmc-name">${this.escapeHTML(team.name)}</span>
              <span class="tmc-tag">[${this.escapeHTML(team.tag || '')}]</span>
            </div>
          </div>
          <button class="tmc-delete-btn" onclick="window.adminApp.deleteTeam('${team.id}')">
            🗑️ Hapus Tim
          </button>
        </div>

        <!-- AUTO-SAVE INPUT COLUMNS DIRECTLY UNDER TEAM NAME -->
        <div class="tmc-input-grid">
          <!-- BOOYAH INPUT -->
          <div class="tmc-field-col">
            <label class="tmc-field-label">👑 BOOYAH</label>
            <div class="tmc-stepper">
              <button type="button" class="tmc-step-btn" onclick="window.adminApp.stepField('${team.id}', 'booyah', -1)">-</button>
              <input type="number" id="input-booyah-${team.id}" class="tmc-step-input" value="${team.booyah || 0}" min="0"
                oninput="window.adminApp.updateTeamScoreAutoSave('${team.id}', 'booyah', this.value)">
              <button type="button" class="tmc-step-btn" onclick="window.adminApp.stepField('${team.id}', 'booyah', 1)">+</button>
            </div>
          </div>

          <!-- ELIMS INPUT -->
          <div class="tmc-field-col">
            <label class="tmc-field-label">🎯 ELIMS (KILLS)</label>
            <div class="tmc-stepper">
              <button type="button" class="tmc-step-btn" onclick="window.adminApp.stepField('${team.id}', 'elims', -1)">-</button>
              <input type="number" id="input-elims-${team.id}" class="tmc-step-input" value="${team.elims || 0}" min="0"
                oninput="window.adminApp.updateTeamScoreAutoSave('${team.id}', 'elims', this.value)">
              <button type="button" class="tmc-step-btn" onclick="window.adminApp.stepField('${team.id}', 'elims', 1)">+</button>
            </div>
          </div>

          <!-- PLACEMENT PTS INPUT -->
          <div class="tmc-field-col">
            <label class="tmc-field-label">🏁 PLACEMENT PTS</label>
            <div class="tmc-stepper">
              <button type="button" class="tmc-step-btn" onclick="window.adminApp.stepField('${team.id}', 'placementPts', -1)">-</button>
              <input type="number" id="input-placementPts-${team.id}" class="tmc-step-input" value="${team.placementPts || 0}" min="0"
                oninput="window.adminApp.updateTeamScoreAutoSave('${team.id}', 'placementPts', this.value)">
              <button type="button" class="tmc-step-btn" onclick="window.adminApp.stepField('${team.id}', 'placementPts', 1)">+</button>
            </div>
            <!-- Quick preset buttons for convenience -->
            <div class="tmc-quick-pts">
              <button type="button" class="btn-quick-rank" title="Rank 1 (+12 pts & +1 Booyah)" onclick="window.adminApp.addQuickRankPts('${team.id}', 12, true)">+12 (Booyah)</button>
              <button type="button" class="btn-quick-rank" title="Rank 2 (+9 pts)" onclick="window.adminApp.addQuickRankPts('${team.id}', 9, false)">+9</button>
              <button type="button" class="btn-quick-rank" title="Rank 3 (+8 pts)" onclick="window.adminApp.addQuickRankPts('${team.id}', 8, false)">+8</button>
              <button type="button" class="btn-quick-rank" title="Rank 4 (+7 pts)" onclick="window.adminApp.addQuickRankPts('${team.id}', 7, false)">+7</button>
            </div>
          </div>

          <!-- TOTAL PTS & AUTO SAVE STATUS -->
          <div class="tmc-total-box">
            <span class="tmc-field-label" style="text-align: right;">TOTAL POIN</span>
            <div class="tmc-total-val" id="total-display-${team.id}">${team.total || 0}</div>
            <span class="tmc-save-status" id="save-badge-${team.id}">✓ Tersimpan Otomatis</span>
          </div>
        </div>
      `;

      this.container.appendChild(card);
    });
  }

  // ---------------- SPONSOR MANAGEMENT ----------------
  handleAddSponsor() {
    const nameInput = document.getElementById('sponsor-name-input');
    const catInput = document.getElementById('sponsor-cat-input');
    const fileInput = document.getElementById('sponsor-file-input');
    const urlInput = document.getElementById('sponsor-url-input');

    const name = nameInput.value.trim();
    const category = catInput.value.trim().toUpperCase() || 'OFFICIAL SPONSOR';

    if (!name) return;

    const finalizeAdd = (imageUrl) => {
      const newSponsor = {
        id: 'spon-' + Date.now(),
        name: name,
        category: category,
        imageUrl: imageUrl
      };

      this.sponsors.push(newSponsor);
      window.syncEngine.saveSponsors(this.sponsors, true, this.adminId);

      nameInput.value = '';
      if (fileInput) fileInput.value = '';
      if (urlInput) urlInput.value = '';

      this.renderSponsors();
    };

    // If file chosen, convert to base64 Data URL (Works everywhere!)
    if (fileInput && fileInput.files && fileInput.files[0]) {
      const file = fileInput.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        finalizeAdd(e.target.result);
      };
      reader.readAsDataURL(file);
    } else if (urlInput && urlInput.value.trim()) {
      finalizeAdd(urlInput.value.trim());
    } else {
      alert('Pilih file gambar logo sponsor atau masukkan URL gambar!');
    }
  }

  deleteSponsor(sponId) {
    if (this.sponsors.length <= 1) {
      alert('Minimal harus ada 1 sponsor!');
      return;
    }
    const spon = this.sponsors.find(s => s.id === sponId);
    if (!spon) return;
    if (confirm(`Hapus sponsor "${spon.name}"?`)) {
      this.sponsors = this.sponsors.filter(s => s.id !== sponId);
      window.syncEngine.saveSponsors(this.sponsors, true, this.adminId);
      this.renderSponsors();
    }
  }

  renderSponsors() {
    if (!this.sponsorsContainer) return;
    this.sponsorsContainer.innerHTML = '';

    this.sponsors.forEach((spon) => {
      const item = document.createElement('div');
      item.className = 'sponsor-item-card';

      item.innerHTML = `
        <div class="sic-left">
          <img src="${spon.imageUrl}" alt="${this.escapeHTML(spon.name)}" class="sic-thumb">
          <div class="sic-meta">
            <span class="sic-name">${this.escapeHTML(spon.name)}</span>
            <span class="sic-category">${this.escapeHTML(spon.category || 'OFFICIAL SPONSOR')}</span>
          </div>
        </div>
        <button type="button" class="tmc-delete-btn" onclick="window.adminApp.deleteSponsor('${spon.id}')">
          🗑️ Hapus
        </button>
      `;

      this.sponsorsContainer.appendChild(item);
    });
  }

  escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.adminApp = new AdminController();
});
