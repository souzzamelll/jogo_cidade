/**
 * Isometric Rendering Engine for Cidade em Caos
 */

class IsometricEngine {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.game = game;

    this.tileWidth = 84;
    this.tileHeight = 42;

    this.camera = {
      x: 0,
      y: 0,
      zoom: 1.0,
      targetX: 0,
      targetY: 0,
      targetZoom: 1.0
    };

    this.hoverTile = null;
    this.selectedTile = null;

    // Day/Night and Weather Cycle
    this.dayNightTime = 0; // 0 to 180s cycle
    this.dayCycleDuration = 120.0;
    this.ambientLight = 1.0;
    this.isNight = false;

    // Particle pool
    this.particles = [];

    // Wind animation
    this.windTime = 0;
    this.fountainTime = 0;
    this.turbineRotation = 0;

    // Lightning flash timer
    this.lightningFlash = 0;

    // Rain particles
    this.rainDrops = [];
    for (let i = 0; i < 180; i++) {
      this.rainDrops.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        len: 15 + Math.random() * 20,
        speed: 700 + Math.random() * 400
      });
    }

    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.centerCamera();
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  centerCamera() {
    const midX = (this.game.city.size / 2);
    const midY = (this.game.city.size / 2);
    const screen = this.gridToScreen(midX, midY);
    this.camera.x = this.canvas.width / 2 - screen.x;
    this.camera.y = this.canvas.height / 2 - screen.y - 40;
    this.camera.targetX = this.camera.x;
    this.camera.targetY = this.camera.y;
    this.camera.zoom = 1.0;
    this.camera.targetZoom = 1.0;
  }

  gridToScreen(gx, gy) {
    const sx = (gx - gy) * (this.tileWidth / 2);
    const sy = (gx + gy) * (this.tileHeight / 2);
    return { x: sx, y: sy };
  }

  screenToGrid(screenX, screenY) {
    // Invert zoom and camera pan
    const cx = (screenX - this.canvas.width / 2) / this.camera.zoom + (this.canvas.width / 2) - this.camera.x;
    const cy = (screenY - this.canvas.height / 2) / this.camera.zoom + (this.canvas.height / 2) - this.camera.y;

    const halfW = this.tileWidth / 2;
    const halfH = this.tileHeight / 2;

    const gx = (cx / halfW + cy / halfH) / 2;
    const gy = (cy / halfH - cx / halfW) / 2;

    return {
      x: Math.floor(gx),
      y: Math.floor(gy)
    };
  }

  panTo(gx, gy) {
    const screen = this.gridToScreen(gx + 0.5, gy + 0.5);
    this.camera.targetX = this.canvas.width / 2 - screen.x;
    this.camera.targetY = this.canvas.height / 2 - screen.y - 30;
  }

  addParticle(p) {
    this.particles.push(p);
  }

  update(dt) {
    // Smooth camera interpolation
    this.camera.x += (this.camera.targetX - this.camera.x) * 10 * dt;
    this.camera.y += (this.camera.targetY - this.camera.y) * 10 * dt;
    this.camera.zoom += (this.camera.targetZoom - this.camera.zoom) * 10 * dt;

    // Day/Night progression
    this.dayNightTime = (this.dayNightTime + dt) % this.dayCycleDuration;
    const progress = this.dayNightTime / this.dayCycleDuration; // 0 to 1
    // Ambient light: 1 at midday (0.5), drops to 0.45 at night (0.0 / 1.0)
    const sinLight = Math.sin(progress * Math.PI * 2);
    this.ambientLight = 0.72 + 0.28 * sinLight;
    this.isNight = sinLight < -0.2;

    // Environmental animations
    this.windTime += dt * 3;
    this.fountainTime += dt * 8;
    this.turbineRotation += dt * 4;

    // Lightning during storm
    if (this.game.crises.stormActive) {
      if (Math.random() < 0.015) {
        this.lightningFlash = 0.25; // flash for 250ms
        if (window.soundSystem) window.soundSystem.playThunder();
      }
    }
    if (this.lightningFlash > 0) {
      this.lightningFlash -= dt;
    }

    // Rain drops
    if (this.game.crises.stormActive) {
      for (const drop of this.rainDrops) {
        drop.y += drop.speed * dt;
        drop.x -= (drop.speed * 0.25) * dt;
        if (drop.y > this.canvas.height) {
          drop.y = -drop.len;
          drop.x = Math.random() * (this.canvas.width + 200);
        }
      }
    }

    // Update particles (smoke, fire, water, sparks)
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.sizeGrowth) p.size += p.sizeGrowth * dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // Spawn crisis visual particles
    for (const crisis of this.game.crises.activeCrises) {
      const screen = this.gridToScreen(crisis.x + 0.5, crisis.y + 0.5);

      if (crisis.type === 'fire') {
        // Fire & smoke particles
        if (Math.random() < 0.6) {
          this.addParticle({
            x: screen.x + (Math.random() - 0.5) * 28,
            y: screen.y - 45 + (Math.random() - 0.5) * 15,
            vx: (Math.random() - 0.5) * 15,
            vy: -40 - Math.random() * 35,
            size: 8 + Math.random() * 10,
            sizeGrowth: 12,
            color: Math.random() > 0.4 ? 'rgba(239, 68, 68, 0.8)' : 'rgba(245, 158, 11, 0.85)',
            life: 0.6,
            maxLife: 0.6
          });
        }
        // Black billowing smoke
        if (Math.random() < 0.4) {
          this.addParticle({
            x: screen.x + (Math.random() - 0.5) * 20,
            y: screen.y - 65,
            vx: (Math.random() - 0.5) * 12 + 10,
            vy: -35 - Math.random() * 20,
            size: 14 + Math.random() * 12,
            sizeGrowth: 15,
            color: 'rgba(55, 65, 81, 0.6)',
            life: 1.2,
            maxLife: 1.2
          });
        }
      } else if (crisis.type === 'blackout') {
        // Electric sparks
        if (Math.random() < 0.25) {
          this.addParticle({
            x: screen.x + (Math.random() - 0.5) * 30,
            y: screen.y - 30 + (Math.random() - 0.5) * 20,
            vx: (Math.random() - 0.5) * 60,
            vy: (Math.random() - 0.5) * 60,
            size: 3,
            color: '#60a5fa',
            life: 0.2,
            maxLife: 0.2
          });
        }
      } else if (crisis.type === 'pollution') {
        // Toxic green haze
        if (Math.random() < 0.3) {
          this.addParticle({
            x: screen.x + (Math.random() - 0.5) * 40,
            y: screen.y - 30 + (Math.random() - 0.5) * 15,
            vx: (Math.random() - 0.5) * 15,
            vy: -15 - Math.random() * 15,
            size: 20 + Math.random() * 15,
            sizeGrowth: 10,
            color: 'rgba(52, 211, 153, 0.25)',
            life: 1.5,
            maxLife: 1.5
          });
        }
      }
    }
  }

  render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Sky background gradient based on time of day
    let skyTop = '#1e293b';
    let skyBottom = '#0f172a';

    if (this.isNight) {
      skyTop = '#090d16';
      skyBottom = '#131b2e';
    } else {
      // Daylight / warm horizon
      skyTop = '#38bdf8';
      skyBottom = '#bae6fd';
      if (this.ambientLight < 0.8) {
        // Dusk/Dawn orange tint
        skyTop = '#c026d3';
        skyBottom = '#f97316';
      }
    }

    if (this.game.crises.stormActive) {
      skyTop = '#1e293b';
      skyBottom = '#334155';
    }

    const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
    skyGrad.addColorStop(0, skyTop);
    skyGrad.addColorStop(1, skyBottom);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // Camera Transform
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(this.camera.zoom, this.camera.zoom);
    ctx.translate(-w / 2 + this.camera.x, -h / 2 + this.camera.y);

    // Draw City Ground & Buildings in strict isometric depth order (x + y)
    const size = this.game.city.size;

    // Pass 1: Ground Tiles & Roads
    for (let depth = 0; depth < size * 2; depth++) {
      for (let x = 0; x <= depth; x++) {
        const y = depth - x;
        if (x < size && y < size) {
          this.renderTile(x, y);
        }
      }
    }

    // Pass 2: Vertical Structures (Buildings, Trees, Cars, Pedestrians) sorted by depth
    for (let depth = 0; depth < size * 2; depth++) {
      for (let x = 0; x <= depth; x++) {
        const y = depth - x;
        if (x < size && y < size) {
          this.renderVerticalElements(x, y);
        }
      }
    }

    // Pass 3: Particles in world coordinates
    this.renderParticles();

    // Pass 4: Ghost building preview (if building is selected)
    if (this.game.selectedBuildTool && this.hoverTile) {
      this.renderBuildGhost(this.hoverTile.x, this.hoverTile.y, this.game.selectedBuildTool);
    }

    // Pass 5: 3D Floating Crisis Badges & Health Rings
    this.renderCrisisBadges();

    ctx.restore();

    // Pass 6: Fullscreen weather overlays (Rain, Lightning Flash, Night Darkness)
    this.renderWeatherOverlays();
  }

  renderTile(x, y) {
    const ctx = this.ctx;
    const cell = this.game.city.getCell(x, y);
    if (!cell) return;

    const screen = this.gridToScreen(x, y);
    const hw = this.tileWidth / 2;
    const hh = this.tileHeight / 2;

    ctx.save();
    ctx.translate(screen.x, screen.y);

    // Is water tile?
    if (cell.waterTile) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(hw, hh);
      ctx.lineTo(0, this.tileHeight);
      ctx.lineTo(-hw, hh);
      ctx.closePath();

      // Shimmering water
      const waterGrad = ctx.createLinearGradient(-hw, 0, hw, this.tileHeight);
      waterGrad.addColorStop(0, '#0284c7');
      waterGrad.addColorStop(0.5, '#38bdf8');
      waterGrad.addColorStop(1, '#0369a1');
      ctx.fillStyle = waterGrad;
      ctx.fill();

      // Wave ripple
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const waveOffset = Math.sin(this.fountainTime + x + y) * 3;
      ctx.moveTo(-hw * 0.4, hh + waveOffset);
      ctx.lineTo(hw * 0.4, hh - waveOffset);
      ctx.stroke();

      ctx.restore();
      return;
    }

    // Ground tile path
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(hw, hh);
    ctx.lineTo(0, this.tileHeight);
    ctx.lineTo(-hw, hh);
    ctx.closePath();

    if (cell.building && cell.building.id === 'road') {
      // Asphalt road
      ctx.fillStyle = '#334155';
      ctx.fill();
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Road markings (yellow dashed line or junction)
      this.renderRoadMarkings(x, y, hw, hh);
    } else {
      // Grass tile with lush texture
      const grassGrad = ctx.createLinearGradient(-hw, 0, hw, this.tileHeight);
      // Vary grass hue slightly based on coordinates
      const hueShift = ((x * 13 + y * 17) % 7) - 3;
      grassGrad.addColorStop(0, `hsl(${140 + hueShift}, 48%, 38%)`);
      grassGrad.addColorStop(1, `hsl(${140 + hueShift}, 52%, 28%)`);
      ctx.fillStyle = grassGrad;
      ctx.fill();

      // Subtle grid border
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    // Hover or selected highlight
    const isHover = this.hoverTile && this.hoverTile.x === x && this.hoverTile.y === y;
    const isSelected = this.selectedTile && this.selectedTile.x === x && this.selectedTile.y === y;

    if (isSelected) {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    } else if (isHover) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.restore();
  }

  renderRoadMarkings(x, y, hw, hh) {
    const ctx = this.ctx;
    const neighbors = this.game.city.getRoadNeighbors(x, y);

    ctx.strokeStyle = '#facc15'; // yellow road markings
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);

    // Check connections
    const hasN = neighbors.some(n => n.dir === 'N');
    const hasS = neighbors.some(n => n.dir === 'S');
    const hasE = neighbors.some(n => n.dir === 'E');
    const hasW = neighbors.some(n => n.dir === 'W');

    // Central line connections
    if (hasN || hasS) {
      ctx.beginPath();
      if (hasN) {
        ctx.moveTo(0, hh);
        ctx.lineTo(-hw / 2, hh / 2);
      }
      if (hasS) {
        ctx.moveTo(0, hh);
        ctx.lineTo(hw / 2, hh * 1.5);
      }
      ctx.stroke();
    }

    if (hasE || hasW) {
      ctx.beginPath();
      if (hasW) {
        ctx.moveTo(0, hh);
        ctx.lineTo(-hw / 2, hh * 1.5);
      }
      if (hasE) {
        ctx.moveTo(0, hh);
        ctx.lineTo(hw / 2, hh / 2);
      }
      ctx.stroke();
    }

    ctx.setLineDash([]); // reset dash

    // Traffic light indicator if present on this cell
    const cell = this.game.city.getCell(x, y);
    if (cell && cell.trafficLight) {
      this.renderTrafficLightPost(cell.trafficLight, hw, hh);
    }
  }

  renderTrafficLightPost(light, hw, hh) {
    const ctx = this.ctx;
    ctx.save();
    // Position traffic light pole on road corner
    const px = hw * 0.7;
    const py = hh * 0.3;

    // Pole
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px, py - 24);
    ctx.stroke();

    // Box
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(px - 4, py - 32, 8, 14);

    // Light bulb
    const isGreen = light.state === 'NS_GREEN';
    ctx.fillStyle = isGreen ? '#22c55e' : '#ef4444';
    ctx.beginPath();
    ctx.arc(px, py - (isGreen ? 22 : 28), 3, 0, Math.PI * 2);
    ctx.fill();

    // Glow aura
    ctx.fillStyle = isGreen ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)';
    ctx.beginPath();
    ctx.arc(px, py - (isGreen ? 22 : 28), 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  renderVerticalElements(x, y) {
    const cell = this.game.city.getCell(x, y);
    if (!cell) return;

    const screen = this.gridToScreen(x, y);

    // 1. Render building on this tile if exists
    if (cell.building && cell.building.id !== 'road') {
      this.renderBuilding(cell.building.id, screen.x, screen.y, cell);
    }

    // 2. Render vehicles that are currently in this tile's sector
    this.renderVehiclesOnTile(x, y);

    // 3. Render pedestrians on this tile
    this.renderPedestriansOnTile(x, y);
  }

  renderBuilding(id, sx, sy, cell) {
    const ctx = this.ctx;
    const hw = this.tileWidth / 2;
    const hh = this.tileHeight / 2;

    ctx.save();
    ctx.translate(sx, sy);

    const isBlackout = cell.incident && cell.incident.type === 'blackout';

    switch (id) {
      case 'residential_small': {
        const height = 40;
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.beginPath();
        ctx.ellipse(0, hh, hw * 0.9, hh * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();

        // Left wall
        ctx.fillStyle = '#cbd5e1';
        ctx.beginPath();
        ctx.moveTo(-hw * 0.6, hh);
        ctx.lineTo(0, hh * 1.5);
        ctx.lineTo(0, hh * 1.5 - height);
        ctx.lineTo(-hw * 0.6, hh - height);
        ctx.closePath();
        ctx.fill();

        // Right wall
        ctx.fillStyle = '#94a3b8';
        ctx.beginPath();
        ctx.moveTo(0, hh * 1.5);
        ctx.lineTo(hw * 0.6, hh);
        ctx.lineTo(hw * 0.6, hh - height);
        ctx.lineTo(0, hh * 1.5 - height);
        ctx.closePath();
        ctx.fill();

        // Roof (Red gable roof)
        ctx.fillStyle = '#e11d48';
        ctx.beginPath();
        ctx.moveTo(-hw * 0.7, hh - height);
        ctx.lineTo(0, hh * 1.6 - height);
        ctx.lineTo(0, -height - 18);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#be123c';
        ctx.beginPath();
        ctx.moveTo(0, hh * 1.6 - height);
        ctx.lineTo(hw * 0.7, hh - height);
        ctx.lineTo(0, -height - 18);
        ctx.closePath();
        ctx.fill();

        // Chimney
        ctx.fillStyle = '#64748b';
        ctx.fillRect(-hw * 0.35, -height - 12, 6, 14);

        // Windows (glow at night if has power)
        this.renderWindows(-hw * 0.4, hh - height + 10, 8, 8, isBlackout);
        this.renderWindows(hw * 0.2, hh - height + 10, 8, 8, isBlackout);
        break;
      }

      case 'residential_high': {
        const height = 75;
        // Modern skyscraper apartment
        // Left wall
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.moveTo(-hw * 0.7, hh);
        ctx.lineTo(0, hh * 1.6);
        ctx.lineTo(0, hh * 1.6 - height);
        ctx.lineTo(-hw * 0.7, hh - height);
        ctx.closePath();
        ctx.fill();

        // Right wall
        ctx.fillStyle = '#0284c7';
        ctx.beginPath();
        ctx.moveTo(0, hh * 1.6);
        ctx.lineTo(hw * 0.7, hh);
        ctx.lineTo(hw * 0.7, hh - height);
        ctx.lineTo(0, hh * 1.6 - height);
        ctx.closePath();
        ctx.fill();

        // Roof
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.moveTo(-hw * 0.7, hh - height);
        ctx.lineTo(0, hh * 1.6 - height);
        ctx.lineTo(hw * 0.7, hh - height);
        ctx.lineTo(0, hh * 0.4 - height);
        ctx.closePath();
        ctx.fill();

        // Rooftop AC unit
        ctx.fillStyle = '#64748b';
        ctx.fillRect(-6, hh - height - 12, 12, 10);

        // Window matrix
        for (let row = 0; row < 5; row++) {
          this.renderWindows(-hw * 0.5, hh - height + 12 + row * 12, 7, 7, isBlackout);
          this.renderWindows(-hw * 0.25, hh - height + 17 + row * 12, 7, 7, isBlackout);
          this.renderWindows(hw * 0.15, hh - height + 17 + row * 12, 7, 7, isBlackout);
          this.renderWindows(hw * 0.4, hh - height + 12 + row * 12, 7, 7, isBlackout);
        }
        break;
      }

      case 'commercial': {
        const height = 65;
        // Office & Shopping Tower
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.moveTo(-hw * 0.75, hh);
        ctx.lineTo(0, hh * 1.65);
        ctx.lineTo(0, hh * 1.65 - height);
        ctx.lineTo(-hw * 0.75, hh - height);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#d97706';
        ctx.beginPath();
        ctx.moveTo(0, hh * 1.65);
        ctx.lineTo(hw * 0.75, hh);
        ctx.lineTo(hw * 0.75, hh - height);
        ctx.lineTo(0, hh * 1.65 - height);
        ctx.closePath();
        ctx.fill();

        // Glass top
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.moveTo(-hw * 0.75, hh - height);
        ctx.lineTo(0, hh * 1.65 - height);
        ctx.lineTo(hw * 0.75, hh - height);
        ctx.lineTo(0, hh * 0.35 - height);
        ctx.closePath();
        ctx.fill();

        // Neon branding sign
        ctx.fillStyle = isBlackout ? '#475569' : '#38bdf8';
        ctx.font = 'bold 9px sans-serif';
        ctx.fillText('CITY MALL', -20, hh - height + 14);

        // Large glass shopfronts
        this.renderWindows(-hw * 0.55, hh - 12, 16, 12, isBlackout);
        this.renderWindows(hw * 0.15, hh - 12, 16, 12, isBlackout);
        break;
      }

      case 'park': {
        // Pond in the center
        ctx.fillStyle = '#0ea5e9';
        ctx.beginPath();
        ctx.ellipse(0, hh, hw * 0.45, hh * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();

        // Fountain jet
        ctx.fillStyle = '#bae6fd';
        const jetH = 12 + Math.sin(this.fountainTime) * 4;
        ctx.fillRect(-2, hh - jetH, 4, jetH);
        ctx.beginPath();
        ctx.arc(0, hh - jetH, 4, 0, Math.PI * 2);
        ctx.fill();

        // Lush trees surrounding the pond
        this.renderTree(-hw * 0.5, hh * 0.7);
        this.renderTree(hw * 0.5, hh * 0.7);
        this.renderTree(0, hh * 1.4);
        break;
      }

      case 'power_wind': {
        // Wind turbine
        const poleH = 55;
        ctx.strokeStyle = '#f1f5f9';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(0, hh);
        ctx.lineTo(0, hh - poleH);
        ctx.stroke();

        // Center hub
        ctx.fillStyle = '#94a3b8';
        ctx.beginPath();
        ctx.arc(0, hh - poleH, 4, 0, Math.PI * 2);
        ctx.fill();

        // 3 Rotating Blades
        ctx.save();
        ctx.translate(0, hh - poleH);
        ctx.rotate(this.turbineRotation);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(0, -26);
          ctx.stroke();
          ctx.rotate((Math.PI * 2) / 3);
        }
        ctx.restore();
        break;
      }

      case 'power_solar': {
        // Solar farm panels
        const panelColor = isBlackout ? '#334155' : '#1e3a8a';
        for (let row = 0; row < 2; row++) {
          ctx.fillStyle = panelColor;
          ctx.beginPath();
          const oy = hh * 0.5 + row * 16;
          ctx.moveTo(-hw * 0.6, oy);
          ctx.lineTo(hw * 0.6, oy - 12);
          ctx.lineTo(hw * 0.6, oy - 4);
          ctx.lineTo(-hw * 0.6, oy + 8);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#60a5fa';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        break;
      }

      case 'power_plant': {
        // Power Plant with dual chimneys
        const height = 45;
        ctx.fillStyle = '#475569';
        ctx.beginPath();
        ctx.moveTo(-hw * 0.7, hh);
        ctx.lineTo(0, hh * 1.6);
        ctx.lineTo(0, hh * 1.6 - height);
        ctx.lineTo(-hw * 0.7, hh - height);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.moveTo(0, hh * 1.6);
        ctx.lineTo(hw * 0.7, hh);
        ctx.lineTo(hw * 0.7, hh - height);
        ctx.lineTo(0, hh * 1.6 - height);
        ctx.closePath();
        ctx.fill();

        // Cooling towers
        ctx.fillStyle = '#64748b';
        ctx.fillRect(-hw * 0.4, hh - height - 25, 14, 28);
        ctx.fillRect(hw * 0.1, hh - height - 25, 14, 28);

        // Warning red lights
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(-hw * 0.4 + 7, hh - height - 26, 2.5, 0, Math.PI * 2);
        ctx.arc(hw * 0.1 + 7, hh - height - 26, 2.5, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'fire_station': {
        const height = 48;
        // Firehouse
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.moveTo(-hw * 0.7, hh);
        ctx.lineTo(0, hh * 1.6);
        ctx.lineTo(0, hh * 1.6 - height);
        ctx.lineTo(-hw * 0.7, hh - height);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#b91c1c';
        ctx.beginPath();
        ctx.moveTo(0, hh * 1.6);
        ctx.lineTo(hw * 0.7, hh);
        ctx.lineTo(hw * 0.7, hh - height);
        ctx.lineTo(0, hh * 1.6 - height);
        ctx.closePath();
        ctx.fill();

        // Garage door
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(-hw * 0.4, hh - 12, 16, 20);
        ctx.fillStyle = '#f87171';
        ctx.fillRect(-hw * 0.38, hh - 10, 14, 18);

        // Fire department insignia
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText('🚒', hw * 0.1, hh - height + 24);
        break;
      }

      case 'hospital': {
        const height = 55;
        // Hospital building
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.moveTo(-hw * 0.75, hh);
        ctx.lineTo(0, hh * 1.65);
        ctx.lineTo(0, hh * 1.65 - height);
        ctx.lineTo(-hw * 0.75, hh - height);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.moveTo(0, hh * 1.65);
        ctx.lineTo(hw * 0.75, hh);
        ctx.lineTo(hw * 0.75, hh - height);
        ctx.lineTo(0, hh * 1.65 - height);
        ctx.closePath();
        ctx.fill();

        // Roof helipad
        ctx.fillStyle = '#475569';
        ctx.beginPath();
        ctx.moveTo(-hw * 0.75, hh - height);
        ctx.lineTo(0, hh * 1.65 - height);
        ctx.lineTo(hw * 0.75, hh - height);
        ctx.lineTo(0, hh * 0.35 - height);
        ctx.closePath();
        ctx.fill();

        // Helipad Yellow 'H'
        ctx.fillStyle = '#facc15';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText('H', -6, hh - height + 6);

        // Red Cross on facade
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-hw * 0.4, hh - height + 16, 12, 4);
        ctx.fillRect(-hw * 0.4 + 4, hh - height + 12, 4, 12);
        break;
      }

      case 'police': {
        const height = 48;
        // Police station
        ctx.fillStyle = '#1e3a8a';
        ctx.beginPath();
        ctx.moveTo(-hw * 0.7, hh);
        ctx.lineTo(0, hh * 1.6);
        ctx.lineTo(0, hh * 1.6 - height);
        ctx.lineTo(-hw * 0.7, hh - height);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#172554';
        ctx.beginPath();
        ctx.moveTo(0, hh * 1.6);
        ctx.lineTo(hw * 0.7, hh);
        ctx.lineTo(hw * 0.7, hh - height);
        ctx.lineTo(0, hh * 1.6 - height);
        ctx.closePath();
        ctx.fill();

        // Flashing blue roof beacon
        const isBlink = Math.floor(Date.now() / 250) % 2 === 0;
        ctx.fillStyle = isBlink ? '#38bdf8' : '#1d4ed8';
        ctx.beginPath();
        ctx.arc(0, hh - height - 4, 4, 0, Math.PI * 2);
        ctx.fill();

        // Police badge icon
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText('🚓', -hw * 0.4, hh - height + 24);
        break;
      }

      case 'bus_station': {
        // Bus terminal canopy
        ctx.fillStyle = '#334155';
        ctx.fillRect(-hw * 0.6, hh - 18, hw * 1.2, 8);
        ctx.fillStyle = '#0284c7';
        ctx.fillRect(-hw * 0.5, hh - 12, 4, 12);
        ctx.fillRect(hw * 0.4, hh - 12, 4, 12);

        // Bus icon
        ctx.fillStyle = '#facc15';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText('🚌', -8, hh - 4);
        break;
      }
    }

    ctx.restore();
  }

  renderTree(ox, oy) {
    const ctx = this.ctx;
    // Trunk
    ctx.fillStyle = '#78350f';
    ctx.fillRect(ox - 2, oy - 14, 4, 14);

    // Leaves with sway
    const sway = Math.sin(this.windTime + ox) * 1.5;
    ctx.fillStyle = '#15803d';
    ctx.beginPath();
    ctx.arc(ox + sway, oy - 20, 11, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(ox + sway - 2, oy - 23, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  renderWindows(wx, wy, w, h, isBlackout) {
    const ctx = this.ctx;
    if (isBlackout) {
      ctx.fillStyle = '#1e293b'; // dark unlit
    } else if (this.isNight) {
      ctx.fillStyle = '#fde047'; // warm yellow glow at night
    } else {
      ctx.fillStyle = '#93c5fd'; // sky reflection in daytime
    }
    ctx.fillRect(wx, wy, w, h);
  }

  renderVehiclesOnTile(x, y) {
    const ctx = this.ctx;
    const allVehicles = [...this.game.city.vehicles, ...this.game.city.emergencyVehicles];

    for (const v of allVehicles) {
      // Interpolate position along path
      const curX = v.x + (v.nextX - v.x) * v.progress;
      const curY = v.y + (v.nextY - v.y) * v.progress;

      if (Math.floor(curX) === x && Math.floor(curY) === y) {
        const screen = this.gridToScreen(curX + 0.5, curY + 0.5);

        ctx.save();
        ctx.translate(screen.x, screen.y + 12);

        // Direction vector
        const dx = v.nextX - v.x;
        const dy = v.nextY - v.y;

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(0, 0, 9, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Car Body
        ctx.fillStyle = v.color;
        ctx.beginPath();
        ctx.roundRect(-8, -10, 16, 10, 3);
        ctx.fill();

        // Windshield
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(-5, -8, 10, 4);

        // Emergency Flashing Beacon
        if (v.isEmergency) {
          const flasherColor = Math.floor(v.flasher) % 2 === 0 ? '#ef4444' : '#3b82f6';
          ctx.fillStyle = flasherColor;
          ctx.beginPath();
          ctx.arc(0, -12, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }

        // Headlights at night
        if (this.isNight) {
          ctx.fillStyle = 'rgba(254, 240, 138, 0.4)';
          ctx.beginPath();
          ctx.moveTo(0, -5);
          ctx.lineTo(dx * 25 - dy * 10, dy * 15);
          ctx.lineTo(dx * 25 + dy * 10, dy * 15);
          ctx.closePath();
          ctx.fill();
        }

        ctx.restore();
      }
    }
  }

  renderPedestriansOnTile(x, y) {
    const ctx = this.ctx;
    for (const p of this.game.city.pedestrians) {
      if (Math.floor(p.x) === x && Math.floor(p.y) === y) {
        const screen = this.gridToScreen(p.x, p.y);
        const bob = Math.abs(Math.sin(p.walkTime)) * 2.5;

        ctx.save();
        ctx.translate(screen.x, screen.y + 16 - bob);

        // Tiny shadow
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.ellipse(0, bob, 3, 1.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Head
        ctx.fillStyle = '#fed7aa';
        ctx.beginPath();
        ctx.arc(0, -9, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Shirt
        ctx.fillStyle = p.color;
        ctx.fillRect(-2, -6.5, 4, 5);

        ctx.restore();
      }
    }
  }

  renderParticles() {
    const ctx = this.ctx;
    for (const p of this.particles) {
      ctx.save();
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(1, p.size), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  renderBuildGhost(gx, gy, buildingId) {
    const ctx = this.ctx;
    const bDef = window.BUILDING_TYPES[buildingId];
    if (!bDef) return;

    const cell = this.game.city.getCell(gx, gy);
    if (!cell) return;

    const screen = this.gridToScreen(gx, gy);
    const hw = this.tileWidth / 2;
    const hh = this.tileHeight / 2;

    const canAfford = this.game.money >= bDef.cost;
    const canBuild = canAfford && !cell.building && !cell.waterTile;

    ctx.save();
    ctx.translate(screen.x, screen.y);

    // Highlight polygon
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(hw, hh);
    ctx.lineTo(0, this.tileHeight);
    ctx.lineTo(-hw, hh);
    ctx.closePath();

    ctx.fillStyle = canBuild ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)';
    ctx.fill();
    ctx.strokeStyle = canBuild ? '#22c55e' : '#ef4444';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Ghost icon preview
    ctx.font = '24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(bDef.icon, 0, hh - 10);

    ctx.restore();
  }

  renderCrisisBadges() {
    const ctx = this.ctx;
    const now = Date.now();

    for (const crisis of this.game.crises.activeCrises) {
      const screen = this.gridToScreen(crisis.x + 0.5, crisis.y + 0.5);
      const bob = Math.sin(now / 200) * 4;

      ctx.save();
      ctx.translate(screen.x, screen.y - 75 + bob);

      // Warning marker ring
      const radius = 18;
      const progress = Math.max(0, crisis.timer / crisis.maxTimer);

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.arc(2, 3, radius, 0, Math.PI * 2);
      ctx.fill();

      // Outer ring background
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();

      // Outer countdown timer ring (color shifts from green -> yellow -> red)
      let ringColor = '#22c55e';
      if (progress < 0.35) ringColor = '#ef4444';
      else if (progress < 0.65) ringColor = '#f59e0b';

      ctx.strokeStyle = ringColor;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, radius, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * progress));
      ctx.stroke();

      // Badge Inner Circle
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(0, 0, radius - 2, 0, Math.PI * 2);
      ctx.fill();

      // Icon
      let icon = '🔥';
      if (crisis.type === 'blackout') icon = '⚡';
      else if (crisis.type === 'accident') icon = '🚗';
      else if (crisis.type === 'hospital') icon = '🏥';
      else if (crisis.type === 'pollution') icon = '☣️';
      else if (crisis.type === 'riot') icon = '📢';

      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(icon, 0, 0);

      // Pulse exclamation mark badge
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(13, -12, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText('!', 13, -12);

      ctx.restore();
    }
  }

  renderWeatherOverlays() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // 1. Day / Night Darkness filter
    if (this.ambientLight < 0.95 && !this.game.crises.stormActive) {
      const darkness = (1.0 - this.ambientLight) * 0.55;
      ctx.fillStyle = `rgba(15, 23, 42, ${darkness})`;
      ctx.fillRect(0, 0, w, h);
    }

    // 2. Storm Rain & Darkness
    if (this.game.crises.stormActive) {
      // Dark slate tint
      ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
      ctx.fillRect(0, 0, w, h);

      // Rain streaks
      ctx.strokeStyle = 'rgba(186, 230, 253, 0.65)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (const drop of this.rainDrops) {
        ctx.moveTo(drop.x, drop.y);
        ctx.lineTo(drop.x - drop.len * 0.25, drop.y + drop.len);
      }
      ctx.stroke();
    }

    // 3. Lightning Flash
    if (this.lightningFlash > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.8, this.lightningFlash * 4)})`;
      ctx.fillRect(0, 0, w, h);
    }
  }
}

window.IsometricEngine = IsometricEngine;
