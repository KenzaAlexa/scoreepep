/**
 * FREE FIRE SCOREBOARD CONTROLLER (app.js)
 * Enhanced:
 * - Buttery Smooth FLIP Reordering Animation (Broadcast Grade)
 * - Persistent DOM nodes (No layout flashing / zero stiffness)
 * - Clean number display on BOOYAH (Crown icon removed)
 * - 0ms Realtime Sync Listener
 */

class ScoreboardApp {
  constructor() {
    this.container = document.getElementById('scoreboard-rows');
    this.thresholdEl = document.getElementById('cr-threshold-num');
    this.formulaNoteEl = document.getElementById('formula-rule-note');
    this.totalTeamsCountEl = document.getElementById('stat-total-teams');
    this.totalBooyahsEl = document.getElementById('stat-total-booyah');
    this.topElimsTeamEl = document.getElementById('stat-top-elims');
    this.mascotBubbleEl = document.getElementById('mascot-bubble-text');
    this.liveIndicatorEl = document.getElementById('live-indicator-pill');

    this.sponsorCategoryEl = document.getElementById('sponsor-category-text');
    this.sponsorImgEl = document.getElementById('sponsor-img-current');
    this.sponsorTrackEl = document.getElementById('sponsor-image-track');
    this.sponsors = [];
    this.currentSponsorIndex = 0;
    this.sponsorIntervalTimer = null;

    this.teams = [];
    this.oldRankMap = {};
    this.audioCtx = null;
    this.soundEnabled = true;

    this.init();
  }

  init() {
    try { this.initAudio(); } catch (_) {}
    try { this.initSponsorCarousel(); } catch (e) { console.error('Sponsor carousel init error:', e); }
    try { this.setupSyncListener(); } catch (e) { console.error('Sync listener init error:', e); }
    try { this.setupMascotInteractions(); } catch (e) { console.error('Mascot interactions init error:', e); }
    try { this.loadInitial(); } catch (e) { console.error('Load initial error:', e); }
  }

  initAudio() {
    try {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    } catch (_) {}
  }

  playTone(freq = 440, type = 'sine', duration = 0.2, volume = 0.1) {
    if (!this.soundEnabled) return;
    try {
      if (!this.audioCtx) this.initAudio();
      if (!this.audioCtx) return;
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
      gain.gain.setValueAtTime(volume, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + duration);
    } catch (_) {}
  }

  playRankUpSFX() {
    if (!this.soundEnabled) return;
    try {
      this.playTone(523.25, 'triangle', 0.12, 0.1);
      setTimeout(() => this.playTone(659.25, 'triangle', 0.12, 0.1), 100);
      setTimeout(() => this.playTone(783.99, 'triangle', 0.25, 0.12), 200);
    } catch (_) {}
  }

  initSponsorCarousel() {
    this.sponsors = window.syncEngine.getSponsors();
    if (this.sponsors && this.sponsors.length > 0) {
      this.displaySponsor(this.sponsors[0], false);
      this.startSponsorRotation();
    }
  }

  startSponsorRotation() {
    if (this.sponsorIntervalTimer) clearInterval(this.sponsorIntervalTimer);
    const settings = window.syncEngine.getSettings();
    const intervalMs = ((settings.sponsorIntervalSeconds || 3.5) * 1000);

    this.sponsorIntervalTimer = setInterval(() => {
      this.rotateNextSponsor();
    }, intervalMs);
  }

  rotateNextSponsor() {
    if (!this.sponsors || this.sponsors.length === 0 || !this.sponsorImgEl) return;
    this.currentSponsorIndex = (this.currentSponsorIndex + 1) % this.sponsors.length;
    const sponsor = this.sponsors[this.currentSponsorIndex];
    this.displaySponsor(sponsor, true);
  }

  displaySponsor(sponsor, animated = true) {
    if (!sponsor || !this.sponsorImgEl) return;

    const makeFallbackSvg = (name) => {
      const safeName = (name || 'SPONSOR').replace(/[<>&"]/g, '');
      return `data:image/svg+xml;charset=utf-8,` + encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 60"><rect width="240" height="60" fill="#060920" rx="4" stroke="#FFE600" stroke-width="2"/><text x="120" y="38" font-family="'Chakra Petch',Arial,sans-serif" font-weight="900" font-size="18" fill="#FFE600" text-anchor="middle" letter-spacing="2">${safeName.toUpperCase()}</text></svg>`
      );
    };

    const targetSrc = (sponsor.imageUrl && sponsor.imageUrl.trim()) ? sponsor.imageUrl : makeFallbackSvg(sponsor.name);

    // Attach robust error fallback to prevent broken image icons
    this.sponsorImgEl.onerror = () => {
      this.sponsorImgEl.onerror = null;
      this.sponsorImgEl.src = makeFallbackSvg(sponsor.name);
    };

    const applyData = () => {
      this.sponsorImgEl.src = targetSrc;
      this.sponsorImgEl.alt = sponsor.name || 'Sponsor';
      this.sponsorImgEl.title = sponsor.name || 'Sponsor';
      if (this.sponsorCategoryEl) {
        this.sponsorCategoryEl.textContent = sponsor.category || 'OFFICIAL SPONSOR';
      }
      this.sponsorImgEl.classList.remove('fade-out');
      this.sponsorImgEl.classList.add('fade-in');
    };

    if (animated) {
      this.sponsorImgEl.classList.remove('fade-in');
      this.sponsorImgEl.classList.add('fade-out');
      setTimeout(applyData, 280);
    } else {
      applyData();
    }
  }

  setupSyncListener() {
    window.syncEngine.onUpdate((payload) => {
      this.flashLivePill();
      
      // Cloud status badge update
      if (payload && payload.type === 'CLOUD_STATUS') {
        const liveText = document.querySelector('.obs-live-text');
        const liveDot = document.querySelector('.obs-live-dot');
        if (liveText && liveDot) {
          if (payload.connected) {
            liveDot.style.background = '#00FF88';
            liveDot.style.boxShadow = '0 0 10px #00FF88';
            liveText.textContent = 'CLOUD LIVE';
          } else {
            liveDot.style.background = 'var(--cyan)';
            liveDot.style.boxShadow = '0 0 8px var(--cyan)';
            liveText.textContent = 'CONNECTING...';
          }
        }
      }

      // Realtime sponsor update: Always switch to newest sponsor so user sees it instantly!
      if (payload && (payload.type === 'SPONSORS_UPDATE' || payload.sponsors)) {
        this.sponsors = window.syncEngine.getSponsors();
        if (this.sponsors.length > 0) {
          this.currentSponsorIndex = Math.max(0, this.sponsors.length - 1);
          this.displaySponsor(this.sponsors[this.currentSponsorIndex], true);
        }
        this.startSponsorRotation();
      }

      this.updateScoreboard(true);
    });
  }

  flashLivePill() {
    if (this.liveIndicatorEl) {
      this.liveIndicatorEl.style.borderColor = 'var(--yellow)';
      setTimeout(() => {
        if (this.liveIndicatorEl) this.liveIndicatorEl.style.borderColor = '';
      }, 500);
    }
  }

  loadInitial() {
    this.updateScoreboard(false);
  }

  sortTeams(teams) {
    return [...teams].sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      if (b.booyah !== a.booyah) return b.booyah - a.booyah;
      if (b.placementPts !== a.placementPts) return b.placementPts - a.placementPts;
      return b.elims - a.elims;
    });
  }

  updateScoreboard(animate = true) {
    const raw = window.syncEngine.getData();
    const settings = window.syncEngine.getSettings();

    if (this.thresholdEl) {
      this.thresholdEl.textContent = settings.championRushThreshold || 118;
    }
    if (this.formulaNoteEl) {
      if (settings.formulaMode === 'custom_bonus' && settings.booyahBonusPoints > 0) {
        this.formulaNoteEl.textContent = `ELIMS + PLACEMENT + (BOOYAH × ${settings.booyahBonusPoints} PTS)`;
      } else {
        this.formulaNoteEl.textContent = `ELIMS (1 PT) + PLACEMENT PTS`;
      }
    }

    const sorted = this.sortTeams(raw);

    // Detect newly added team
    const prevIds = new Set(this.teams.map(t => t.id));
    const newlyAddedTeam = sorted.find(t => !prevIds.has(t.id));

    if (animate && this.teams.length > 0) {
      this.runSmoothFLIP(sorted, settings, newlyAddedTeam ? newlyAddedTeam.id : null);
    } else {
      this.renderFull(sorted, settings);
    }

    if (newlyAddedTeam && this.teams.length > 0) {
      this.mascotSay(`🎉 TIM BARU BERGABUNG: ${newlyAddedTeam.name}!`, 4500);
      this.playRankUpSFX();
    }

    this.updateSideStats(sorted);
    this.teams = sorted;

    // Cache current ranks
    this.oldRankMap = {};
    sorted.forEach((t, i) => {
      this.oldRankMap[t.id] = i + 1;
    });
  }

  // BUTTERY SMOOTH FLIP REORDERING
  runSmoothFLIP(sorted, settings, newTeamId = null) {
    if (!this.container) return;

    // 1. FIRST: Capture current positions of all existing rows
    const firstTop = {};
    const rowMap = {};
    this.container.querySelectorAll('.team-row').forEach(row => {
      const id = row.getAttribute('data-team-id');
      if (id) {
        firstTop[id] = row.getBoundingClientRect().top;
        rowMap[id] = row;
      }
    });

    let rankUpOccurred = false;

    // 2. REORDER & UPDATE EXISTING NODES (Preserves GPU memory and avoids DOM rebuild flash)
    sorted.forEach((team, index) => {
      const rank = index + 1;
      let row = rowMap[team.id];

      if (!row) {
        // Create if new team
        row = this.createRowElement(team, rank, settings);
        if (team.id === newTeamId) {
          row.classList.add('new-team-glow');
          setTimeout(() => {
            row.classList.remove('new-team-glow');
          }, 3500);
        }
      } else {
        // Update content in-place
        this.updateRowContent(row, team, rank, settings);
      }

      // Re-append in sorted order
      this.container.appendChild(row);

      const prevRank = this.oldRankMap[team.id];
      if (prevRank && rank < prevRank) {
        rankUpOccurred = true;
      }
    });

    // Remove any rows for teams that were deleted
    const currentIds = new Set(sorted.map(t => t.id));
    Object.keys(rowMap).forEach(id => {
      if (!currentIds.has(id)) {
        rowMap[id].remove();
      }
    });

    // 3. LAST & INVERT
    const newRows = this.container.querySelectorAll('.team-row');
    newRows.forEach(row => {
      const id = row.getAttribute('data-team-id');
      const oldY = firstTop[id];

      if (oldY !== undefined) {
        const newY = row.getBoundingClientRect().top;
        const deltaY = oldY - newY;

        if (deltaY !== 0) {
          row.classList.remove('animate-glide');
          row.style.transform = `translateY(${deltaY}px)`;
        }
      }
    });

    // Force browser reflow
    this.container.offsetHeight;

    // 4. PLAY with smooth spring easing
    requestAnimationFrame(() => {
      newRows.forEach(row => {
        const id = row.getAttribute('data-team-id');
        const rank = parseInt(row.getAttribute('data-rank'), 10);
        const prevRank = this.oldRankMap[id];

        row.classList.add('animate-glide');
        row.style.transform = '';

        // If team improved rank, apply smooth glowing highlight
        if (prevRank && rank < prevRank) {
          row.classList.add('rank-up-smooth');
          setTimeout(() => {
            row.classList.remove('rank-up-smooth');
          }, 1500);
        }
      });

      if (rankUpOccurred) {
        this.playRankUpSFX();
        this.mascotSay('🚀 RANK UP! TIM MELUNCUR NAIK! 🔥');
      }
    });
  }

  renderFull(sorted, settings) {
    if (!this.container) return;
    this.container.innerHTML = '';
    sorted.forEach((team, index) => {
      const rank = index + 1;
      const row = this.createRowElement(team, rank, settings);
      this.container.appendChild(row);
    });
  }

  createRowElement(team, rank, settings) {
    const row = document.createElement('div');
    row.className = `team-row rank-${rank <= 3 ? rank : 'normal'} animate-glide`;
    row.setAttribute('data-team-id', team.id);
    row.setAttribute('data-rank', rank);
    this.updateRowContent(row, team, rank, settings);
    return row;
  }

  updateRowContent(row, team, rank, settings) {
    row.className = `team-row rank-${rank <= 3 ? rank : 'normal'} animate-glide`;
    row.setAttribute('data-rank', rank);

    let rankBadgeClass = 'rb-normal';
    if (rank === 1) rankBadgeClass = 'rb-1';
    else if (rank <= 5) rankBadgeClass = `rb-${rank}`;

    // Clean row markup without country flag
    row.innerHTML = `
      <div class="rank-col">
        <div class="rank-badge ${rankBadgeClass}">${rank}</div>
      </div>
      <div class="team-info-col">
        <div class="team-logo-avatar">${team.logoText || team.tag?.substring(0, 2) || 'FF'}</div>
        <div class="team-name-group">
          <span class="team-display-name">${this.escapeHTML(team.name)}</span>
          <span class="team-display-tag">${this.escapeHTML(team.tag || '')}</span>
        </div>
      </div>
      <div class="booyah-col">${team.booyah || 0}</div>
      <div class="elims-col">${team.elims || 0}</div>
      <div class="placement-col">${team.placementPts || 0}</div>
      <div class="total-col">
        <div class="total-pill">${team.total || 0}</div>
      </div>
    `;
  }

  updateSideStats(sorted) {
    if (this.totalTeamsCountEl) {
      this.totalTeamsCountEl.textContent = sorted.length;
    }
    const totalBooyahs = sorted.reduce((sum, t) => sum + (parseInt(t.booyah || 0, 10)), 0);
    if (this.totalBooyahsEl) {
      this.totalBooyahsEl.textContent = totalBooyahs;
    }
    if (sorted.length > 0) {
      const topElimsTeam = [...sorted].sort((a, b) => b.elims - a.elims)[0];
      if (this.topElimsTeamEl && topElimsTeam) {
        this.topElimsTeamEl.textContent = `${topElimsTeam.tag || topElimsTeam.name} (${topElimsTeam.elims})`;
      }
    }
  }

  mascotSay(msg, duration = 3000) {
    if (!this.mascotBubbleEl) return;
    this.mascotBubbleEl.textContent = msg;
    this.mascotBubbleEl.style.transform = 'rotate(-3deg) scale(1.08)';
    setTimeout(() => {
      if (this.mascotBubbleEl) this.mascotBubbleEl.style.transform = 'rotate(-1.5deg) scale(1)';
    }, 250);

    if (this.mascotTimeout) clearTimeout(this.mascotTimeout);
    this.mascotTimeout = setTimeout(() => {
      if (this.mascotBubbleEl) this.mascotBubbleEl.textContent = '✦ BOOYAH! LIVE SCOREBOARD ✦';
    }, duration);
  }

  setupMascotInteractions() {
    const mascot = document.querySelector('.mascot-img-element');
    if (mascot) {
      mascot.addEventListener('click', () => {
        const lines = [
          '✦ SIAPA YANG AKAN BOOYAH? ✦',
          '✦ 118 POINTS MENUJU CHAMPION RUSH! ✦',
          '✦ VIXEL SIAP CATAT SKOR TERBAIK! ✦',
          '✦ IT-FESTIVAL 2026 SEMANGAT! ✦'
        ];
        const pick = lines[Math.floor(Math.random() * lines.length)];
        this.mascotSay(pick, 3500);
        this.playTone(659, 'triangle', 0.25, 0.1);
      });
    }
  }

  escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.scoreboardApp = new ScoreboardApp();
  });
} else {
  window.scoreboardApp = new ScoreboardApp();
}
