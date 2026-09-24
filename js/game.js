/**
 * Main Game Controller for Cidade em Caos
 */

class Game {
  constructor() {
    this.city = new CityGrid(16);
    this.crises = new CrisisSystem(this);
    this.canvas = document.getElementById('city-canvas');
    this.engine = new IsometricEngine(this.canvas, this);

    // Resources
    this.money = 1500;
    this.energyProduced = 0;
    this.energyConsumed = 0;
    this.population = 150;
    this.satisfaction = 82; // %
    this.chaos = 5; // %
    this.maxPopulationReached = 150;
    this.totalMoneyHandled = 1500;
    this.crisesSolved = 0;

    // Simulation timing
    this.elapsedTime = 0;
    this.gameSpeed = 1.0;
    this.isPaused = false;
    this.isGameOver = false;
    this.lastTimestamp = 0;
    this.economyTimer = 3.0;

    // Interaction state
    this.selectedBuildTool = null; // building id or 'demolish'
    this.selectedCrisis = null;
    this.isDragging = false;
    this.dragStart = { x: 0, y: 0 };
    this.dragCameraStart = { x: 0, y: 0 };
    this.hasDraggedDistance = false;

    // Notification history
    this.notifications = [];

    this.initUI();
    this.initControls();
    this.updateEconomy();
    this.updateHUD();

    // Start Animation Loop
    requestAnimationFrame((t) => this.loop(t));
  }

  reset() {
    this.city = new CityGrid(16);
    this.crises = new CrisisSystem(this);
    this.engine = new IsometricEngine(this.canvas, this);

    this.money = 1500;
    this.energyProduced = 0;
    this.energyConsumed = 0;
    this.population = 150;
    this.satisfaction = 82;
    this.chaos = 5;
    this.maxPopulationReached = 150;
    this.totalMoneyHandled = 1500;
    this.crisesSolved = 0;

    this.elapsedTime = 0;
    this.gameSpeed = 1.0;
    this.isPaused = false;
    this.isGameOver = false;
    this.economyTimer = 3.0;

    this.selectedBuildTool = null;
    this.selectedCrisis = null;
    this.notifications = [];

    // Hide GameOver Modal
    const modal = document.getElementById('game-over-modal');
    if (modal) modal.classList.remove('active');

    // Close crisis modal
    this.closeCrisisModal();

    this.updateEconomy();
    this.updateHUD();
    this.renderNotifications();

    this.addNotification('🏙️ Nova administração assumiu a cidade! Mantenha a ordem.', 'info');
    if (window.soundSystem) window.soundSystem.playSuccess();
  }

  spendMoney(amount) {
    this.money -= amount;
    this.updateHUD();
    return this.money >= 0;
  }

  addNotification(text, type = 'info', crisisRef = null) {
    const item = {
      id: 'notif_' + Math.random().toString(36).substr(2, 6),
      text,
      type, // 'info', 'warning', 'danger', 'success'
      crisisRef,
      time: new Date().toLocaleTimeString().slice(0, 5)
    };
    this.notifications.unshift(item);
    if (this.notifications.length > 8) {
      this.notifications.pop();
    }
    this.renderNotifications();
  }

  renderNotifications() {
    const container = document.getElementById('news-ticker-list');
    if (!container) return;

    container.innerHTML = '';
    this.notifications.forEach(n => {
      const el = document.createElement('div');
      el.className = `ticker-item ${n.type}`;
      el.innerHTML = `
        <span class="ticker-time">${n.time}</span>
        <span class="ticker-text">${n.text}</span>
      `;
      if (n.crisisRef) {
        const btn = document.createElement('button');
        btn.className = 'btn-ticker-goto';
        btn.innerText = '🔍 IR ATÉ';
        btn.onclick = (e) => {
          e.stopPropagation();
          this.engine.panTo(n.crisisRef.x, n.crisisRef.y);
          this.openCrisisModal(n.crisisRef);
        };
        el.appendChild(btn);
      }
      container.appendChild(el);
    });
  }

  initUI() {
    // Build tabs switching
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const target = btn.dataset.tab;
        document.querySelectorAll('.build-category').forEach(cat => {
          cat.classList.toggle('active', cat.id === `cat-${target}`);
        });
        if (window.soundSystem) window.soundSystem.playClick();
      });
    });

    // Build item buttons
    const buildBtns = document.querySelectorAll('.build-card');
    buildBtns.forEach(card => {
      card.addEventListener('click', () => {
        const buildId = card.dataset.building;
        if (this.selectedBuildTool === buildId) {
          // Deselect
          this.selectedBuildTool = null;
          card.classList.remove('selected');
        } else {
          buildBtns.forEach(c => c.classList.remove('selected'));
          card.classList.add('selected');
          this.selectedBuildTool = buildId;
        }
        if (window.soundSystem) window.soundSystem.playClick();
      });
    });

    // Speed controls
    const btnPause = document.getElementById('btn-speed-pause');
    const btn1x = document.getElementById('btn-speed-1x');
    const btn2x = document.getElementById('btn-speed-2x');

    if (btnPause) {
      btnPause.onclick = () => {
        this.isPaused = !this.isPaused;
        btnPause.classList.toggle('active', this.isPaused);
        if (window.soundSystem) window.soundSystem.playClick();
      };
    }
    if (btn1x) {
      btn1x.onclick = () => {
        this.isPaused = false;
        this.gameSpeed = 1.0;
        if (btnPause) btnPause.classList.remove('active');
        btn1x.classList.add('active');
        if (btn2x) btn2x.classList.remove('active');
        if (window.soundSystem) window.soundSystem.playClick();
      };
    }
    if (btn2x) {
      btn2x.onclick = () => {
        this.isPaused = false;
        this.gameSpeed = 2.2;
        if (btnPause) btnPause.classList.remove('active');
        btn2x.classList.add('active');
        if (btn1x) btn1x.classList.remove('active');
        if (window.soundSystem) window.soundSystem.playClick();
      };
    }

    // Zoom and Center Controls
    const btnZoomIn = document.getElementById('btn-zoom-in');
    const btnZoomOut = document.getElementById('btn-zoom-out');
    const btnCenter = document.getElementById('btn-center');

    if (btnZoomIn) {
      btnZoomIn.onclick = () => {
        this.engine.camera.targetZoom = Math.min(1.8, this.engine.camera.targetZoom + 0.2);
        if (window.soundSystem) window.soundSystem.playClick();
      };
    }
    if (btnZoomOut) {
      btnZoomOut.onclick = () => {
        this.engine.camera.targetZoom = Math.max(0.6, this.engine.camera.targetZoom - 0.2);
        if (window.soundSystem) window.soundSystem.playClick();
      };
    }
    if (btnCenter) {
      btnCenter.onclick = () => {
        this.engine.centerCamera();
        if (window.soundSystem) window.soundSystem.playClick();
      };
    }

    // Sound Mute Toggle
    const btnMute = document.getElementById('btn-sound-toggle');
    if (btnMute) {
      btnMute.onclick = () => {
        if (window.soundSystem) {
          const unmuted = window.soundSystem.toggleMute();
          btnMute.innerHTML = unmuted ? '🔊' : '🔇';
          btnMute.title = unmuted ? 'Som Ativado' : 'Som Mutado';
        }
      };
    }

    // Restart button in Game Over modal
    const btnRestart = document.getElementById('btn-restart');
    if (btnRestart) {
      btnRestart.onclick = () => {
        this.reset();
      };
    }

    // Instructions modal dismiss
    const btnDismissHelp = document.getElementById('btn-dismiss-help');
    const helpModal = document.getElementById('help-modal');
    if (btnDismissHelp && helpModal) {
      btnDismissHelp.onclick = () => {
        helpModal.classList.remove('active');
        if (window.soundSystem) window.soundSystem.playClick();
      };
    }
    const btnOpenHelp = document.getElementById('btn-open-help');
    if (btnOpenHelp && helpModal) {
      btnOpenHelp.onclick = () => {
        helpModal.classList.add('active');
        if (window.soundSystem) window.soundSystem.playClick();
      };
    }
  }

  initControls() {
    const canvas = this.canvas;

    // Mouse Move (Hover & Drag)
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      if (this.isDragging) {
        const dx = mouseX - this.dragStart.x;
        const dy = mouseY - this.dragStart.y;
        if (Math.hypot(dx, dy) > 5) {
          this.hasDraggedDistance = true;
        }
        this.engine.camera.targetX = this.dragCameraStart.x + dx;
        this.engine.camera.targetY = this.dragCameraStart.y + dy;
        return;
      }

      // Calculate hovered grid coordinate
      const grid = this.engine.screenToGrid(mouseX, mouseY);
      if (grid.x >= 0 && grid.x < this.city.size && grid.y >= 0 && grid.y < this.city.size) {
        this.engine.hoverTile = grid;
      } else {
        this.engine.hoverTile = null;
      }
    });

    // Mouse Down
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0 || e.button === 1) { // Left or middle click
        this.isDragging = true;
        this.hasDraggedDistance = false;
        this.dragStart = { x: e.clientX, y: e.clientY };
        this.dragCameraStart = { x: this.engine.camera.targetX, y: this.engine.camera.targetY };
      }
    });

    // Mouse Up (Click)
    window.addEventListener('mouseup', (e) => {
      if (!this.isDragging) return;
      this.isDragging = false;

      // If user just clicked without dragging, perform tile action
      if (!this.hasDraggedDistance && e.target === canvas) {
        const rect = canvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        this.handleTileClick(clickX, clickY);
      }
    });

    // Mouse Wheel Zoom
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 0.15 : -0.15;
      this.engine.camera.targetZoom = Math.max(0.6, Math.min(1.8, this.engine.camera.targetZoom + zoomFactor));
    }, { passive: false });

    // Touch Support for Mobile
    let initialPinchDist = null;
    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        this.isDragging = true;
        this.hasDraggedDistance = false;
        this.dragStart = { x: touch.clientX, y: touch.clientY };
        this.dragCameraStart = { x: this.engine.camera.targetX, y: this.engine.camera.targetY };
      } else if (e.touches.length === 2) {
        this.isDragging = false;
        initialPinchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    });

    canvas.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1 && this.isDragging) {
        const touch = e.touches[0];
        const dx = touch.clientX - this.dragStart.x;
        const dy = touch.clientY - this.dragStart.y;
        if (Math.hypot(dx, dy) > 8) {
          this.hasDraggedDistance = true;
        }
        this.engine.camera.targetX = this.dragCameraStart.x + dx;
        this.engine.camera.targetY = this.dragCameraStart.y + dy;
      } else if (e.touches.length === 2 && initialPinchDist) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const ratio = dist / initialPinchDist;
        this.engine.camera.targetZoom = Math.max(0.6, Math.min(1.8, this.engine.camera.zoom * ratio));
      }
    });

    canvas.addEventListener('touchend', (e) => {
      if (!this.hasDraggedDistance && e.changedTouches.length === 1) {
        const touch = e.changedTouches[0];
        const rect = canvas.getBoundingClientRect();
        this.handleTileClick(touch.clientX - rect.left, touch.clientY - rect.top);
      }
      this.isDragging = false;
      initialPinchDist = null;
    });

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        this.isPaused = !this.isPaused;
        const btnPause = document.getElementById('btn-speed-pause');
        if (btnPause) btnPause.classList.toggle('active', this.isPaused);
      } else if (e.code === 'Escape') {
        this.selectedBuildTool = null;
        document.querySelectorAll('.build-card').forEach(c => c.classList.remove('selected'));
        this.closeCrisisModal();
      }
    });
  }

  handleTileClick(screenX, screenY) {
    if (this.isGameOver) return;

    // First check if user clicked on any floating crisis badge (they are elevated above buildings)
    for (const crisis of this.crises.activeCrises) {
      const screen = this.engine.gridToScreen(crisis.x + 0.5, crisis.y + 0.5);
      // Badge center is screen.y - 75
      const badgeX = screen.x * this.engine.camera.zoom + (this.canvas.width / 2) * (1 - this.engine.camera.zoom) + this.engine.camera.x * this.engine.camera.zoom;
      const badgeY = (screen.y - 75) * this.engine.camera.zoom + (this.canvas.height / 2) * (1 - this.engine.camera.zoom) + this.engine.camera.y * this.engine.camera.zoom;
      const dist = Math.hypot(screenX - badgeX, screenY - badgeY);
      if (dist < 30 * this.engine.camera.zoom) {
        this.openCrisisModal(crisis);
        return;
      }
    }

    const grid = this.engine.screenToGrid(screenX, screenY);
    const cell = this.city.getCell(grid.x, grid.y);
    if (!cell) return;

    // Check if cell has an active crisis
    if (cell.incident) {
      this.openCrisisModal(cell.incident);
      return;
    }

    // Check if cell is a traffic light intersection
    if (cell.trafficLight) {
      this.city.toggleTrafficLight(grid.x, grid.y);
      if (window.soundSystem) window.soundSystem.playClick();
      this.addNotification('🚦 Semáforo alternado manualmente para desafogar a via.', 'info');
      return;
    }

    // Check Build or Demolish action
    if (this.selectedBuildTool) {
      if (this.selectedBuildTool === 'demolish') {
        if (cell.building) {
          this.city.setBuilding(grid.x, grid.y, null);
          if (window.soundSystem) window.soundSystem.playBuild();
          this.addNotification('Demolição concluída!', 'info');
          this.updateEconomy();
        }
      } else {
        const bDef = window.BUILDING_TYPES[this.selectedBuildTool];
        if (bDef) {
          if (cell.waterTile) {
            this.addNotification('Não é possível construir sobre a água!', 'warning');
            return;
          }
          if (cell.building) {
            this.addNotification('Espaço já ocupado por outra estrutura!', 'warning');
            return;
          }
          if (this.money < bDef.cost) {
            this.addNotification('Recursos financeiros insuficientes para esta obra!', 'warning');
            return;
          }

          this.spendMoney(bDef.cost);
          this.city.setBuilding(grid.x, grid.y, bDef.id);
          if (window.soundSystem) window.soundSystem.playBuild();
          this.addNotification(`${bDef.name} construído com sucesso!`, 'success');
          this.updateEconomy();
        }
      }
    } else {
      // Just clicked a building to inspect
      if (cell.building) {
        this.engine.selectedTile = grid;
        this.showBuildingInfo(cell);
      } else {
        this.engine.selectedTile = null;
        this.closeInspectCard();
      }
    }
  }

  showBuildingInfo(cell) {
    const card = document.getElementById('inspect-card');
    if (!card) return;

    const bDef = window.BUILDING_TYPES[cell.building.id];
    if (!bDef) return;

    card.innerHTML = `
      <div class="inspect-header">
        <span class="inspect-icon">${bDef.icon}</span>
        <div class="inspect-title-wrap">
          <h4>${bDef.name}</h4>
          <span class="inspect-cat">${bDef.category.toUpperCase()}</span>
        </div>
        <button class="btn-close-inspect" id="btn-close-inspect">✕</button>
      </div>
      <p class="inspect-desc">${bDef.desc}</p>
      <div class="inspect-stats">
        <span>⚡ Energia: <b>${bDef.energy >= 0 ? '+' + bDef.energy : bDef.energy} MW</b></span>
        <span>👥 População: <b>+${bDef.pop}</b></span>
        <span>💰 Arrecadação: <b>R$ ${bDef.income}/s</b></span>
      </div>
    `;
    card.classList.add('active');

    const btnClose = document.getElementById('btn-close-inspect');
    if (btnClose) {
      btnClose.onclick = () => this.closeInspectCard();
    }
  }

  closeInspectCard() {
    const card = document.getElementById('inspect-card');
    if (card) card.classList.remove('active');
    this.engine.selectedTile = null;
  }

  openCrisisModal(crisis) {
    this.selectedCrisis = crisis;
    const modal = document.getElementById('crisis-modal');
    if (!modal) return;

    modal.innerHTML = `
      <div class="crisis-card">
        <div class="crisis-card-header">
          <span class="crisis-badge-icon">${crisis.title.slice(0, 2)}</span>
          <div class="crisis-card-titles">
            <h3>${crisis.title}</h3>
            <p>${crisis.desc}</p>
          </div>
          <button class="btn-close-crisis" id="btn-close-crisis">✕</button>
        </div>
        <div class="crisis-countdown-bar">
          <div class="crisis-countdown-fill" style="width: ${(crisis.timer / crisis.maxTimer) * 100}%;"></div>
        </div>
        <div class="crisis-actions" id="crisis-actions-container">
        </div>
      </div>
    `;

    const actionsContainer = document.getElementById('crisis-actions-container');
    crisis.actions.forEach(action => {
      const btn = document.createElement('button');
      btn.className = `btn-crisis-action ${this.money < action.cost ? 'disabled' : ''}`;
      btn.innerHTML = `
        <span class="action-icon">${action.icon}</span>
        <span class="action-text">${action.label}</span>
      `;
      btn.onclick = () => {
        const success = action.action(crisis);
        if (success) {
          this.closeCrisisModal();
        }
      };
      actionsContainer.appendChild(btn);
    });

    const btnClose = document.getElementById('btn-close-crisis');
    if (btnClose) {
      btnClose.onclick = () => this.closeCrisisModal();
    }

    modal.classList.add('active');
  }

  closeCrisisModal() {
    this.selectedCrisis = null;
    const modal = document.getElementById('crisis-modal');
    if (modal) modal.classList.remove('active');
  }

  updateEconomy() {
    let produced = 0;
    let consumed = 0;
    let totalCap = 0;
    let baseTax = 0;
    let upkeep = 0;

    for (let y = 0; y < this.city.size; y++) {
      for (let x = 0; x < this.city.size; x++) {
        const cell = this.city.cells[y][x];
        if (cell.building) {
          const b = window.BUILDING_TYPES[cell.building.id];
          if (b) {
            if (b.energy > 0) produced += b.energy;
            else consumed += Math.abs(b.energy);

            totalCap += b.pop;
            baseTax += b.income;
            if (b.category === 'emergency') upkeep += 15;
          }
        }
      }
    }

    this.energyProduced = produced;
    this.energyConsumed = consumed;

    // Adjust population dynamically
    if (this.satisfaction > 60 && this.population < totalCap) {
      this.population += Math.ceil((totalCap - this.population) * 0.05);
    } else if (this.satisfaction < 30) {
      this.population = Math.max(20, this.population - 4);
    }
    if (this.population > this.maxPopulationReached) {
      this.maxPopulationReached = this.population;
    }

    // Revenue tick
    const taxRevenue = Math.floor(baseTax + (this.population * 0.35) * (this.satisfaction / 100));
    const netCashflow = taxRevenue - upkeep;
    this.money += netCashflow;
    if (netCashflow > 0) this.totalMoneyHandled += netCashflow;

    // Power deficit penalty
    if (this.energyProduced < this.energyConsumed) {
      this.satisfaction = Math.max(0, this.satisfaction - 3);
      this.chaos = Math.min(100, this.chaos + 3);
      this.addNotification('⚠️ Déficit de Energia! Construa mais usinas solares ou eólicas.', 'warning');
    }

    this.updateHUD();
  }

  updateHUD() {
    const elMoney = document.getElementById('res-money');
    const elEnergy = document.getElementById('res-energy');
    const elPop = document.getElementById('res-pop');
    const elSat = document.getElementById('res-satisfaction');
    const elChaos = document.getElementById('res-chaos');
    const elChaosFill = document.getElementById('chaos-meter-fill');
    const elTimer = document.getElementById('res-timer');

    if (elMoney) {
      elMoney.innerText = `R$ ${this.money.toLocaleString()}`;
      elMoney.className = this.money < 100 ? 'res-val danger' : 'res-val';
    }

    if (elEnergy) {
      const net = this.energyProduced - this.energyConsumed;
      elEnergy.innerText = `${this.energyConsumed} / ${this.energyProduced} MW (${net >= 0 ? '+' + net : net})`;
      elEnergy.className = net < 0 ? 'res-val danger' : 'res-val';
    }

    if (elPop) {
      elPop.innerText = `${this.population.toLocaleString()} hab`;
    }

    if (elSat) {
      elSat.innerText = `${Math.round(this.satisfaction)}%`;
      elSat.className = this.satisfaction < 35 ? 'res-val danger' : 'res-val';
    }

    if (elChaos) {
      elChaos.innerText = `${Math.round(this.chaos)}%`;
    }

    if (elChaosFill) {
      elChaosFill.style.width = `${Math.min(100, Math.max(0, this.chaos))}%`;
      if (this.chaos > 75) {
        elChaosFill.style.backgroundColor = '#ef4444';
      } else if (this.chaos > 45) {
        elChaosFill.style.backgroundColor = '#f59e0b';
      } else {
        elChaosFill.style.backgroundColor = '#10b981';
      }
    }

    if (elTimer) {
      const mins = Math.floor(this.elapsedTime / 60);
      const secs = Math.floor(this.elapsedTime % 60);
      elTimer.innerText = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
  }

  checkGameOver() {
    if (this.isGameOver) return;

    let reason = null;

    if (this.chaos >= 100) {
      reason = 'O nível de problemas e caos atingiu 100%! As instituições da cidade entraram em pane generalizada.';
    } else if (this.satisfaction <= 0) {
      reason = 'A satisfação dos moradores chegou a 0%! Ocorreu um êxodo em massa e greve geral.';
    } else if (this.money <= -500) {
      reason = 'A prefeitura faliu acumulando dívidas impagáveis!';
    }

    if (reason) {
      this.triggerGameOver(reason);
    }
  }

  triggerGameOver(reason) {
    this.isGameOver = true;
    if (window.soundSystem) window.soundSystem.playGameOver();

    const modal = document.getElementById('game-over-modal');
    if (!modal) return;

    const mins = Math.floor(this.elapsedTime / 60);
    const secs = Math.floor(this.elapsedTime % 60);
    const timeFormatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    document.getElementById('go-reason').innerText = reason;
    document.getElementById('go-time').innerText = timeFormatted;
    document.getElementById('go-pop').innerText = this.maxPopulationReached.toLocaleString();
    document.getElementById('go-money').innerText = `R$ ${this.totalMoneyHandled.toLocaleString()}`;
    document.getElementById('go-crises').innerText = this.crisesSolved;

    // Mayor Rating
    let rank = 'Prefeito Estagiário 🏅';
    if (this.crisesSolved >= 15 && this.elapsedTime > 240) {
      rank = 'Lenda Urbana Municipal 🏆';
    } else if (this.crisesSolved >= 8 || this.elapsedTime > 120) {
      rank = 'Gestor de Crise Resiliente ⭐';
    }
    document.getElementById('go-rank').innerText = rank;

    modal.classList.add('active');
  }

  loop(timestamp) {
    if (!this.lastTimestamp) this.lastTimestamp = timestamp;
    const rawDt = (timestamp - this.lastTimestamp) / 1000;
    this.lastTimestamp = timestamp;

    const dt = Math.min(rawDt, 0.1) * (this.isPaused ? 0 : this.gameSpeed);

    if (!this.isGameOver && dt > 0) {
      this.elapsedTime += dt;

      // Update simulation systems
      this.city.update(dt);
      this.crises.update(dt);
      this.engine.update(dt);

      // Economy timer
      this.economyTimer -= dt;
      if (this.economyTimer <= 0) {
        this.economyTimer = 3.5;
        this.updateEconomy();
      }

      // Passive chaos decay if no active crises
      if (this.crises.activeCrises.length === 0 && this.chaos > 0) {
        this.chaos = Math.max(0, this.chaos - 1.2 * dt);
      }

      this.updateHUD();
      this.checkGameOver();
    } else if (this.isPaused) {
      this.engine.update(0);
    }

    // Always render canvas
    this.engine.render();

    requestAnimationFrame((t) => this.loop(t));
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.game = new Game();
});
