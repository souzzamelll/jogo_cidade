/**
 * Crisis and Event Management System for Cidade em Caos
 */

class CrisisSystem {
  constructor(game) {
    this.game = game;
    this.activeCrises = [];
    this.eventHistory = [];
    this.spawnTimer = 7.0; // starts around 7s
    this.minInterval = 5.0;
    this.maxInterval = 10.0;
    this.stormActive = false;
    this.stormTimer = 0;
  }

  reset() {
    this.activeCrises = [];
    this.eventHistory = [];
    this.spawnTimer = 6.0;
    this.stormActive = false;
    this.stormTimer = 0;
  }

  update(dt) {
    // Weather storm update
    if (this.stormActive) {
      this.stormTimer -= dt;
      if (this.stormTimer <= 0) {
        this.stormActive = false;
        this.game.addNotification('🌤️ A tempestade passou e o céu está abrindo novamente.', 'info');
      }
    }

    // Crisis countdown
    for (let i = this.activeCrises.length - 1; i >= 0; i--) {
      const crisis = this.activeCrises[i];
      crisis.timer -= dt;

      // Update building cell health or status
      const cell = this.game.city.getCell(crisis.x, crisis.y);
      if (cell) {
        cell.incident = crisis;
      }

      if (crisis.timer <= 0) {
        // Crisis timed out! Negative consequences
        this.handleTimeout(crisis);
        this.activeCrises.splice(i, 1);
        if (cell) cell.incident = null;
      }
    }

    // Spawn new random crisis based on city difficulty
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnRandomCrisis();
      // Increase frequency as game time increases
      const progressFactor = Math.min(0.6, this.game.elapsedTime / 400); // gets faster
      const baseMin = Math.max(3.5, 8.0 - progressFactor * 5);
      const baseMax = Math.max(6.5, 14.0 - progressFactor * 7);
      this.spawnTimer = baseMin + Math.random() * (baseMax - baseMin);
    }
  }

  spawnRandomCrisis() {
    const types = ['fire', 'blackout', 'accident', 'hospital', 'pollution'];
    
    // Add storm chance if game progressed
    if (this.game.elapsedTime > 35 && !this.stormActive && Math.random() < 0.2) {
      this.triggerStorm();
      return;
    }

    // Add riot chance if satisfaction is under 55%
    if (this.game.satisfaction < 55 && Math.random() < 0.4) {
      types.push('riot');
    }

    const type = types[Math.floor(Math.random() * types.length)];
    this.triggerCrisis(type);
  }

  triggerCrisis(type, targetCell = null) {
    let crisis = null;

    switch (type) {
      case 'fire':
        crisis = this.createFireCrisis(targetCell);
        break;
      case 'blackout':
        crisis = this.createBlackoutCrisis(targetCell);
        break;
      case 'accident':
        crisis = this.createAccidentCrisis(targetCell);
        break;
      case 'hospital':
        crisis = this.createHospitalCrisis(targetCell);
        break;
      case 'pollution':
        crisis = this.createPollutionCrisis(targetCell);
        break;
      case 'riot':
        crisis = this.createRiotCrisis(targetCell);
        break;
    }

    if (crisis) {
      this.activeCrises.push(crisis);
      const cell = this.game.city.getCell(crisis.x, crisis.y);
      if (cell) cell.incident = crisis;

      // Play alert sound
      if (window.soundSystem) window.soundSystem.playAlert();

      // Log notification
      this.game.addNotification(crisis.title + ': ' + crisis.desc, 'danger', crisis);

      // Increase chaos
      this.game.chaos = Math.min(100, this.game.chaos + 8);
    }

    return crisis;
  }

  createFireCrisis(customCell) {
    let cell = customCell;
    if (!cell) {
      // Find a building that is not already in crisis
      const valid = [];
      for (let y = 0; y < this.game.city.size; y++) {
        for (let x = 0; x < this.game.city.size; x++) {
          const c = this.game.city.cells[y][x];
          if (c.building && c.building.id !== 'road' && !c.incident) {
            valid.push(c);
          }
        }
      }
      if (valid.length === 0) return null;
      cell = valid[Math.floor(Math.random() * valid.length)];
    }

    const fireTruckNear = this.game.city.findBuildingByType('fire_station').length > 0;

    return {
      id: 'cr_' + Math.random().toString(36).substr(2, 8),
      type: 'fire',
      title: '🔥 Incêndio Fora de Controle!',
      desc: `Fogo se alastrando em ${cell.building.name}!`,
      x: cell.x,
      y: cell.y,
      timer: 22.0,
      maxTimer: 22.0,
      actions: [
        {
          id: 'dispatch_fire',
          label: fireTruckNear ? '🚒 Despachar Bombeiros ($80)' : '🚒 Chamar Bombeiros Estaduais ($160)',
          cost: fireTruckNear ? 80 : 160,
          icon: '🚒',
          action: (crisis) => {
            if (this.game.money < (fireTruckNear ? 80 : 160)) {
              this.game.addNotification('Sem dinheiro suficiente para os bombeiros!', 'warning');
              return false;
            }
            this.game.spendMoney(fireTruckNear ? 80 : 160);
            this.game.city.dispatchEmergencyVehicle('fire', crisis.x, crisis.y);
            if (window.soundSystem) {
              window.soundSystem.playSiren();
              window.soundSystem.playExtinguish();
            }
            this.resolveCrisis(crisis, 'Incêndio apagado com sucesso pelas equipes de socorro!');
            return true;
          }
        },
        {
          id: 'sprinklers',
          label: '🧯 Espuma Antichamas Local ($50)',
          cost: 50,
          icon: '🧯',
          action: (crisis) => {
            if (this.game.money < 50) return false;
            this.game.spendMoney(50);
            if (window.soundSystem) window.soundSystem.playExtinguish();
            this.resolveCrisis(crisis, 'Fogo controlado com espuma de extinção rápida.');
            return true;
          }
        },
        {
          id: 'evacuate',
          label: '🏃 Evacuar e Deixar Queimar ($0)',
          cost: 0,
          icon: '🏃',
          action: (crisis) => {
            this.game.satisfaction = Math.max(0, this.game.satisfaction - 6);
            this.game.chaos = Math.min(100, this.game.chaos + 5);
            // Destroy building into rubble
            const c = this.game.city.getCell(crisis.x, crisis.y);
            if (c) c.building = null;
            this.resolveCrisis(crisis, 'O prédio foi evacuado e destruído pelo fogo.');
            return true;
          }
        }
      ]
    };
  }

  createBlackoutCrisis(customCell) {
    let cell = customCell;
    if (!cell) {
      const valid = [];
      for (let y = 0; y < this.game.city.size; y++) {
        for (let x = 0; x < this.game.city.size; x++) {
          const c = this.game.city.cells[y][x];
          if (c.building && c.building.id !== 'road' && !c.incident) {
            valid.push(c);
          }
        }
      }
      if (valid.length === 0) return null;
      cell = valid[Math.floor(Math.random() * valid.length)];
    }

    if (window.soundSystem) window.soundSystem.playPowerSpark();

    return {
      id: 'cr_' + Math.random().toString(36).substr(2, 8),
      type: 'blackout',
      title: '⚡ Apagão na Rede Elétrica!',
      desc: `Curto-circuito deixou ${cell.building.name} e redondezas às escuras.`,
      x: cell.x,
      y: cell.y,
      timer: 25.0,
      maxTimer: 25.0,
      actions: [
        {
          id: 'buy_grid',
          label: '🔌 Comprar Energia de Emergência ($120)',
          cost: 120,
          icon: '🔌',
          action: (crisis) => {
            if (this.game.money < 120) return false;
            this.game.spendMoney(120);
            if (window.soundSystem) window.soundSystem.playCoin();
            this.resolveCrisis(crisis, 'Energia de contingência reestabelecida!');
            return true;
          }
        },
        {
          id: 'overcharge',
          label: '🛠️ Sobrecarga nos Transformadores ($40)',
          cost: 40,
          icon: '🛠️',
          action: (crisis) => {
            if (this.game.money < 40) return false;
            this.game.spendMoney(40);
            if (Math.random() < 0.25) {
              // Trigger a small fire
              this.triggerCrisis('fire', cell);
              this.game.addNotification('⚠️ A sobrecarga causou um curto e fagulhas de incêndio!', 'warning');
            }
            this.resolveCrisis(crisis, 'Rede religada pelos técnicos da concessionária.');
            return true;
          }
        }
      ]
    };
  }

  createAccidentCrisis() {
    const roads = this.game.city.getAllRoads().filter(r => !r.incident);
    if (roads.length === 0) return null;
    const cell = roads[Math.floor(Math.random() * roads.length)];

    return {
      id: 'cr_' + Math.random().toString(36).substr(2, 8),
      type: 'accident',
      title: '🚗 Colisão e Congestionamento!',
      desc: 'Veículos bateram na pista bloqueando a travessia!',
      x: cell.x,
      y: cell.y,
      timer: 24.0,
      maxTimer: 24.0,
      actions: [
        {
          id: 'tow_police',
          label: '🚓 Despachar Guincho & Polícia ($70)',
          cost: 70,
          icon: '🚓',
          action: (crisis) => {
            if (this.game.money < 70) return false;
            this.game.spendMoney(70);
            this.game.city.dispatchEmergencyVehicle('police', crisis.x, crisis.y);
            if (window.soundSystem) window.soundSystem.playSiren();
            this.resolveCrisis(crisis, 'Pista liberada e veículos removidos.');
            return true;
          }
        },
        {
          id: 'detour',
          label: '🔄 Desviar Fluxo Manualmente ($25)',
          cost: 25,
          icon: '🔄',
          action: (crisis) => {
            if (this.game.money < 25) return false;
            this.game.spendMoney(25);
            this.resolveCrisis(crisis, 'Agentes de trânsito organizaram desvio alternativo.');
            return true;
          }
        }
      ]
    };
  }

  createHospitalCrisis() {
    const hospitals = this.game.city.findBuildingByType('hospital');
    let cell = hospitals[0];
    if (!cell) {
      // Pick random residential
      const res = this.game.city.findBuildingByType('residential_high');
      cell = res[0] || this.game.city.cells[4][4];
    }

    return {
      id: 'cr_' + Math.random().toString(36).substr(2, 8),
      type: 'hospital',
      title: '🏥 Surto de Saúde & Hospital Lotado!',
      desc: 'Fila de pacientes na emergência médica com febre alta!',
      x: cell.x,
      y: cell.y,
      timer: 28.0,
      maxTimer: 28.0,
      actions: [
        {
          id: 'hire_doctors',
          label: '🩺 Médicos e Remédios de Plantão ($140)',
          cost: 140,
          icon: '🩺',
          action: (crisis) => {
            if (this.game.money < 140) return false;
            this.game.spendMoney(140);
            this.game.city.dispatchEmergencyVehicle('ambulance', crisis.x, crisis.y);
            if (window.soundSystem) window.soundSystem.playSiren();
            this.resolveCrisis(crisis, 'Médicos controlaram o surto com eficiência!');
            return true;
          }
        },
        {
          id: 'vaccine',
          label: '💊 Campanha de Vacinação Rápida ($60)',
          cost: 60,
          icon: '💊',
          action: (crisis) => {
            if (this.game.money < 60) return false;
            this.game.spendMoney(60);
            this.resolveCrisis(crisis, 'Vacinação em massa estabilizou os casos.');
            return true;
          }
        }
      ]
    };
  }

  createPollutionCrisis() {
    // Pick commercial or power plant or residential
    const valid = [];
    for (let y = 0; y < this.game.city.size; y++) {
      for (let x = 0; x < this.game.city.size; x++) {
        const c = this.game.city.cells[y][x];
        if (c.building && !c.incident) valid.push(c);
      }
    }
    if (valid.length === 0) return null;
    const cell = valid[Math.floor(Math.random() * valid.length)];

    return {
      id: 'cr_' + Math.random().toString(36).substr(2, 8),
      type: 'pollution',
      title: '☣️ Vazamento Químico e Poluição!',
      desc: `Fumaça tóxica detectada sobre ${cell.building.name}!`,
      x: cell.x,
      y: cell.y,
      timer: 26.0,
      maxTimer: 26.0,
      actions: [
        {
          id: 'decontaminate',
          label: '🧪 Equipe de Descontaminação ($110)',
          cost: 110,
          icon: '🧪',
          action: (crisis) => {
            if (this.game.money < 110) return false;
            this.game.spendMoney(110);
            this.resolveCrisis(crisis, 'Área descontaminada com neutralizadores ecológicos.');
            return true;
          }
        },
        {
          id: 'green_barrier',
          label: '🌳 Cinturão Verde Protetor ($150)',
          cost: 150,
          icon: '🌳',
          action: (crisis) => {
            if (this.game.money < 150) return false;
            this.game.spendMoney(150);
            this.game.satisfaction = Math.min(100, this.game.satisfaction + 6);
            this.resolveCrisis(crisis, 'Árvores especiais absorveram os resíduos do ar.');
            return true;
          }
        }
      ]
    };
  }

  createRiotCrisis() {
    const commercial = this.game.city.findBuildingByType('commercial');
    let cell = commercial[0] || this.game.city.cells[6][6];

    return {
      id: 'cr_' + Math.random().toString(36).substr(2, 8),
      type: 'riot',
      title: '📢 Protesto e Tumulto Popular!',
      desc: 'Moradores indignados protestando no centro da cidade!',
      x: cell.x,
      y: cell.y,
      timer: 22.0,
      maxTimer: 22.0,
      actions: [
        {
          id: 'police_calm',
          label: '🚓 Polícia Comunitária ($60)',
          cost: 60,
          icon: '🚓',
          action: (crisis) => {
            if (this.game.money < 60) return false;
            this.game.spendMoney(60);
            this.game.city.dispatchEmergencyVehicle('police', crisis.x, crisis.y);
            if (window.soundSystem) window.soundSystem.playSiren();
            this.resolveCrisis(crisis, 'Manifestação dispersada de forma pacífica.');
            return true;
          }
        },
        {
          id: 'concessions',
          label: '💰 Subsídio e Melhorias Urbanas ($130)',
          cost: 130,
          icon: '💰',
          action: (crisis) => {
            if (this.game.money < 130) return false;
            this.game.spendMoney(130);
            this.game.satisfaction = Math.min(100, this.game.satisfaction + 12);
            this.resolveCrisis(crisis, 'A população aplaudiu as novas medidas!');
            return true;
          }
        }
      ]
    };
  }

  triggerStorm() {
    this.stormActive = true;
    this.stormTimer = 20.0;
    if (window.soundSystem) window.soundSystem.playThunder();

    this.game.addNotification('⛈️ ALERTA METEOROLÓGICO: Tempestade violenta atingindo a cidade!', 'danger');
    this.game.chaos = Math.min(100, this.game.chaos + 15);

    // Strike a random building with lightning causing a fire and blackout
    setTimeout(() => {
      if (this.game.isGameOver) return;
      this.triggerCrisis('fire');
      this.triggerCrisis('blackout');
    }, 1200);
  }

  resolveCrisis(crisis, message) {
    const idx = this.activeCrises.findIndex(c => c.id === crisis.id);
    if (idx !== -1) {
      this.activeCrises.splice(idx, 1);
    }
    const cell = this.game.city.getCell(crisis.x, crisis.y);
    if (cell) cell.incident = null;

    // Rewards & progression
    this.game.crisesSolved++;
    this.game.chaos = Math.max(0, this.game.chaos - 12);
    this.game.satisfaction = Math.min(100, this.game.satisfaction + 4);
    
    // Reward cash for efficiency
    const reward = 30 + Math.floor(Math.random() * 30);
    this.game.money += reward;
    this.game.totalMoneyHandled += reward;

    if (window.soundSystem) window.soundSystem.playSuccess();
    this.game.addNotification(`✅ ${message} (+R$ ${reward})`, 'success');

    // Close crisis modal if it's currently focused on this crisis
    if (this.game.selectedCrisis && this.game.selectedCrisis.id === crisis.id) {
      this.game.closeCrisisModal();
    }
  }

  handleTimeout(crisis) {
    // Severe penalty when crisis expires unattended!
    this.game.chaos = Math.min(100, this.game.chaos + 18);
    this.game.satisfaction = Math.max(0, this.game.satisfaction - 14);

    if (crisis.type === 'fire') {
      // Destroy building
      const cell = this.game.city.getCell(crisis.x, crisis.y);
      if (cell && cell.building) {
        this.game.addNotification(`💥 ${cell.building.name} foi consumido pelas chamas!`, 'danger');
        cell.building = null; // burned down
      }
    } else {
      this.game.addNotification(`❌ A crise "${crisis.title}" piorou e causou revolta na cidade!`, 'danger');
    }

    if (this.game.selectedCrisis && this.game.selectedCrisis.id === crisis.id) {
      this.game.closeCrisisModal();
    }
  }
}

window.CrisisSystem = CrisisSystem;
