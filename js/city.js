/**
 * City Simulation & Data Model for Cidade em Caos
 */

const BUILDING_TYPES = {
  road: {
    id: 'road',
    name: 'Estrada Asfaltada',
    category: 'infra',
    cost: 40,
    energy: 0,
    pop: 0,
    income: 0,
    satisfaction: 0,
    desc: 'Permite fluxo de tráfego de carros e viaturas de emergência.',
    icon: '🛣️'
  },
  residential_small: {
    id: 'residential_small',
    name: 'Casas Residenciais',
    category: 'zones',
    cost: 150,
    energy: -2,
    pop: 30,
    income: 15,
    satisfaction: 2,
    desc: 'Bairro residencial aconchegante. Aumenta a população e arrecadação.',
    icon: '🏡'
  },
  residential_high: {
    id: 'residential_high',
    name: 'Condomínio Residencial',
    category: 'zones',
    cost: 380,
    energy: -5,
    pop: 90,
    income: 45,
    satisfaction: 1,
    desc: 'Edifício moderno de alta densidade populacional.',
    icon: '🏢'
  },
  commercial: {
    id: 'commercial',
    name: 'Centro Comercial & Escritórios',
    category: 'zones',
    cost: 320,
    energy: -4,
    pop: 0,
    income: 60,
    satisfaction: 3,
    desc: 'Gera empregos e alta arrecadação de tributos.',
    icon: '🏬'
  },
  park: {
    id: 'park',
    name: 'Parque com Lago & Chafariz',
    category: 'zones',
    cost: 180,
    energy: 0,
    pop: 0,
    income: 0,
    satisfaction: 8,
    desc: 'Área verde relaxante. Reduz poluição e aumenta a felicidade.',
    icon: '🌳'
  },
  power_wind: {
    id: 'power_wind',
    name: 'Turbina Eólica',
    category: 'power',
    cost: 320,
    energy: 16,
    pop: 0,
    income: 0,
    satisfaction: 2,
    desc: 'Gera 16 MW de energia 100% limpa e renovável.',
    icon: '🌬️'
  },
  power_solar: {
    id: 'power_solar',
    name: 'Parque Solar Fotovoltaico',
    category: 'power',
    cost: 480,
    energy: 30,
    pop: 0,
    income: 0,
    satisfaction: 3,
    desc: 'Gera 30 MW de eletricidade sem poluição.',
    icon: '☀️'
  },
  power_plant: {
    id: 'power_plant',
    name: 'Usina Termoelétrica',
    category: 'power',
    cost: 750,
    energy: 70,
    pop: 0,
    income: 0,
    satisfaction: -4,
    desc: 'Gera massivos 70 MW, mas causa um pouco de fumaça na região.',
    icon: '🏭'
  },
  fire_station: {
    id: 'fire_station',
    name: 'Corpo de Bombeiros',
    category: 'emergency',
    cost: 500,
    energy: -4,
    pop: 0,
    income: 0,
    satisfaction: 5,
    desc: 'Despacha viaturas de bombeiros para combater incêndios rapidamente.',
    icon: '🚒'
  },
  hospital: {
    id: 'hospital',
    name: 'Hospital Geral Municipal',
    category: 'emergency',
    cost: 600,
    energy: -6,
    pop: 0,
    income: 0,
    satisfaction: 7,
    desc: 'Atende feridos, controla epidemias e envia ambulâncias.',
    icon: '🏥'
  },
  police: {
    id: 'police',
    name: 'Delegacia de Polícia',
    category: 'emergency',
    cost: 450,
    energy: -4,
    pop: 0,
    income: 0,
    satisfaction: 5,
    desc: 'Mantém a ordem pública, atende acidentes e dissipa tumultos.',
    icon: '🚓'
  },
  bus_station: {
    id: 'bus_station',
    name: 'Terminal de Ônibus Integrado',
    category: 'infra',
    cost: 280,
    energy: -3,
    pop: 0,
    income: 20,
    satisfaction: 4,
    desc: 'Reduz congestionamentos e aumenta a mobilidade urbana.',
    icon: '🚏'
  }
};

class CityGrid {
  constructor(size = 16) {
    this.size = size;
    this.cells = [];
    this.vehicles = [];
    this.pedestrians = [];
    this.trafficLights = [];
    this.emergencyVehicles = [];
    this.initGrid();
  }

  initGrid() {
    this.cells = [];
    for (let y = 0; y < this.size; y++) {
      this.cells[y] = [];
      for (let x = 0; x < this.size; x++) {
        this.cells[y][x] = {
          x,
          y,
          building: null,
          level: 1,
          hasPower: true,
          incident: null,
          trafficLight: null,
          waterTile: false,
          health: 100,
          pollution: 0
        };
      }
    }

    // Set up a natural small river or canal on the edge or corner
    for (let i = 0; i < this.size; i++) {
      if (i >= 12 && i <= 14) {
        // small lake/corner
        this.cells[0][i].waterTile = true;
        this.cells[1][i].waterTile = true;
      }
    }

    this.createInitialTown();
  }

  createInitialTown() {
    // Lay out initial starting grid roads: crossroad in the center
    const mid = Math.floor(this.size / 2);

    // Main Avenue (vertical and horizontal cross)
    for (let i = 3; i <= 12; i++) {
      this.setBuilding(i, mid, 'road');
      this.setBuilding(mid, i, 'road');
    }
    // Loop roads
    for (let i = 4; i <= 11; i++) {
      this.setBuilding(4, i, 'road');
      this.setBuilding(11, i, 'road');
    }

    // Place Initial Essential Town Structures
    // Fire station
    this.setBuilding(mid - 1, mid - 2, 'fire_station');
    // Hospital
    this.setBuilding(mid + 1, mid - 2, 'hospital');
    // Police
    this.setBuilding(mid - 1, mid + 2, 'police');
    // Wind Power & Solar
    this.setBuilding(3, 3, 'power_wind');
    this.setBuilding(3, 4, 'power_solar');
    // Commercial center
    this.setBuilding(mid + 1, mid + 1, 'commercial');
    this.setBuilding(mid + 2, mid + 1, 'commercial');
    // Houses
    this.setBuilding(mid - 2, mid - 1, 'residential_small');
    this.setBuilding(mid - 2, mid + 1, 'residential_small');
    this.setBuilding(mid - 3, mid - 1, 'residential_small');
    this.setBuilding(mid - 3, mid + 1, 'residential_high');
    this.setBuilding(mid + 2, mid - 1, 'residential_small');
    // Central Park
    this.setBuilding(mid - 1, mid - 1, 'park');
    // Bus station
    this.setBuilding(mid + 1, mid + 2, 'bus_station');

    // Create traffic lights at central intersections
    this.addTrafficLight(mid, mid);
    this.addTrafficLight(4, mid);
    this.addTrafficLight(11, mid);
    this.addTrafficLight(mid, 4);
    this.addTrafficLight(mid, 11);

    // Spawn initial cars
    for (let i = 0; i < 5; i++) {
      this.spawnCar();
    }

    // Spawn pedestrians
    for (let i = 0; i < 14; i++) {
      this.spawnPedestrian();
    }
  }

  getCell(x, y) {
    if (x < 0 || x >= this.size || y < 0 || y >= this.size) return null;
    return this.cells[y][x];
  }

  setBuilding(x, y, buildingId) {
    const cell = this.getCell(x, y);
    if (!cell) return false;

    if (buildingId === null) {
      // Demolish
      cell.building = null;
      cell.health = 100;
      if (cell.trafficLight) {
        this.removeTrafficLight(x, y);
      }
      return true;
    }

    const bDef = BUILDING_TYPES[buildingId];
    if (!bDef) return false;

    cell.building = {
      id: bDef.id,
      name: bDef.name,
      category: bDef.category,
      addedAt: Date.now()
    };
    cell.health = 100;

    // Check if new road intersects and could use a traffic light
    if (buildingId === 'road') {
      const neighborRoads = this.getRoadNeighbors(x, y);
      if (neighborRoads.length >= 3 && !cell.trafficLight) {
        this.addTrafficLight(x, y);
      }
    }

    return true;
  }

  addTrafficLight(x, y) {
    const light = {
      x,
      y,
      state: Math.random() > 0.5 ? 'NS_GREEN' : 'EW_GREEN',
      timer: 4 + Math.random() * 3,
      mode: 'auto' // auto or manual
    };
    this.trafficLights.push(light);
    const cell = this.getCell(x, y);
    if (cell) cell.trafficLight = light;
    return light;
  }

  removeTrafficLight(x, y) {
    this.trafficLights = this.trafficLights.filter(l => !(l.x === x && l.y === y));
    const cell = this.getCell(x, y);
    if (cell) cell.trafficLight = null;
  }

  toggleTrafficLight(x, y) {
    const cell = this.getCell(x, y);
    if (cell && cell.trafficLight) {
      cell.trafficLight.state = (cell.trafficLight.state === 'NS_GREEN') ? 'EW_GREEN' : 'NS_GREEN';
      cell.trafficLight.timer = 8; // grant green time
      return cell.trafficLight;
    }
    return null;
  }

  getRoadNeighbors(x, y) {
    const neighbors = [];
    const dirs = [
      { dx: 1, dy: 0, dir: 'E' },
      { dx: -1, dy: 0, dir: 'W' },
      { dx: 0, dy: 1, dir: 'S' },
      { dx: 0, dy: -1, dir: 'N' }
    ];
    for (const d of dirs) {
      const c = this.getCell(x + d.dx, y + d.dy);
      if (c && c.building && c.building.id === 'road') {
        neighbors.push({ x: x + d.dx, y: y + d.dy, dir: d.dir });
      }
    }
    return neighbors;
  }

  isRoad(x, y) {
    const c = this.getCell(x, y);
    return c && c.building && c.building.id === 'road';
  }

  getAllRoads() {
    const roads = [];
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        if (this.isRoad(x, y)) {
          roads.push(this.cells[y][x]);
        }
      }
    }
    return roads;
  }

  findBuildingByType(buildingId) {
    const list = [];
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        const c = this.cells[y][x];
        if (c.building && c.building.id === buildingId) {
          list.push(c);
        }
      }
    }
    return list;
  }

  // Pathfinding on Road Network using BFS/A*
  findRoadPath(startX, startY, endX, endY) {
    // If start is not a road, find adjacent road
    let startRoad = this.isRoad(startX, startY) ? { x: startX, y: startY } : this.getAdjacentRoad(startX, startY);
    let endRoad = this.isRoad(endX, endY) ? { x: endX, y: endY } : this.getAdjacentRoad(endX, endY);

    if (!startRoad || !endRoad) return null;

    const queue = [[startRoad]];
    const visited = new Set();
    visited.add(`${startRoad.x},${startRoad.y}`);

    while (queue.length > 0) {
      const path = queue.shift();
      const current = path[path.length - 1];

      if (current.x === endRoad.x && current.y === endRoad.y) {
        return path;
      }

      const neighbors = this.getRoadNeighbors(current.x, current.y);
      for (const n of neighbors) {
        const key = `${n.x},${n.y}`;
        if (!visited.has(key)) {
          visited.add(key);
          queue.push([...path, { x: n.x, y: n.y }]);
        }
      }
    }
    return null;
  }

  getAdjacentRoad(x, y) {
    const dirs = [
      { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
      { dx: 0, dy: 1 }, { dx: 0, dy: -1 }
    ];
    for (const d of dirs) {
      if (this.isRoad(x + d.dx, y + d.dy)) {
        return { x: x + d.dx, y: y + d.dy };
      }
    }
    return null;
  }

  spawnCar() {
    const roads = this.getAllRoads();
    if (roads.length < 2) return null;

    const start = roads[Math.floor(Math.random() * roads.length)];
    const end = roads[Math.floor(Math.random() * roads.length)];
    if (start.x === end.x && start.y === end.y) return null;

    const path = this.findRoadPath(start.x, start.y, end.x, end.y);
    if (!path || path.length < 2) return null;

    const carTypes = ['#f59e0b', '#ef4444', '#3b82f6', '#10b981', '#8b5cf6', '#ffffff'];
    const car = {
      id: 'car_' + Math.random().toString(36).substr(2, 9),
      path,
      pathIndex: 0,
      x: path[0].x,
      y: path[0].y,
      nextX: path[1].x,
      nextY: path[1].y,
      progress: 0,
      speed: 0.8 + Math.random() * 0.4,
      color: carTypes[Math.floor(Math.random() * carTypes.length)],
      isEmergency: false,
      stopped: false
    };

    this.vehicles.push(car);
    return car;
  }

  spawnPedestrian() {
    // Spawn near residential or park
    let validSpots = [];
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        const c = this.cells[y][x];
        if (c.building && (c.building.category === 'zones' || c.building.id === 'road')) {
          validSpots.push(c);
        }
      }
    }
    if (validSpots.length === 0) return;

    const spot = validSpots[Math.floor(Math.random() * validSpots.length)];
    const colors = ['#f87171', '#60a5fa', '#34d399', '#fbbf24', '#a78bfa', '#f472b6'];

    this.pedestrians.push({
      x: spot.x + 0.2 + Math.random() * 0.6,
      y: spot.y + 0.2 + Math.random() * 0.6,
      targetX: spot.x + Math.random(),
      targetY: spot.y + Math.random(),
      speed: 0.2 + Math.random() * 0.15,
      color: colors[Math.floor(Math.random() * colors.length)],
      walkTime: Math.random() * 10
    });
  }

  dispatchEmergencyVehicle(type, targetX, targetY) {
    // Find matching station
    let stationType = 'fire_station';
    let color = '#ef4444';
    let sirenType = 'fire';
    let vehicleName = 'Caminhão de Bombeiros';

    if (type === 'ambulance') {
      stationType = 'hospital';
      color = '#ffffff';
      sirenType = 'medical';
      vehicleName = 'Ambulância SAMU';
    } else if (type === 'police') {
      stationType = 'police';
      color = '#2563eb';
      sirenType = 'police';
      vehicleName = 'Viatura Policial';
    }

    const stations = this.findBuildingByType(stationType);
    let startStation = stations[0];
    if (!startStation) {
      // If no station built, spawn from map edge road as mutual aid
      const roads = this.getAllRoads();
      if (roads.length === 0) return null;
      startStation = roads[0];
    }

    const path = this.findRoadPath(startStation.x, startStation.y, targetX, targetY);
    if (!path || path.length < 1) return null;

    const ev = {
      id: 'emg_' + Math.random().toString(36).substr(2, 9),
      type,
      name: vehicleName,
      path,
      pathIndex: 0,
      x: path[0].x,
      y: path[0].y,
      nextX: path[1] ? path[1].x : path[0].x,
      nextY: path[1] ? path[1].y : path[0].y,
      progress: 0,
      speed: 1.8, // speeds through traffic
      color,
      isEmergency: true,
      targetX,
      targetY,
      arrived: false,
      flasher: 0
    };

    this.emergencyVehicles.push(ev);
    return ev;
  }

  update(dt) {
    // Update traffic lights
    for (const light of this.trafficLights) {
      light.timer -= dt;
      if (light.timer <= 0) {
        light.state = (light.state === 'NS_GREEN') ? 'EW_GREEN' : 'NS_GREEN';
        light.timer = 5 + Math.random() * 2;
      }
    }

    // Update normal vehicles
    for (let i = this.vehicles.length - 1; i >= 0; i--) {
      const v = this.vehicles[i];
      const curCell = this.getCell(v.nextX, v.nextY);

      // Check if blocked by an accident incident
      if (curCell && curCell.incident && curCell.incident.type === 'accident') {
        v.stopped = true;
        continue;
      }

      // Check traffic light at destination
      if (curCell && curCell.trafficLight) {
        const dx = v.nextX - v.x;
        const dy = v.nextY - v.y;
        const isMovingNS = Math.abs(dy) > Math.abs(dx);
        const lightState = curCell.trafficLight.state;

        if ((isMovingNS && lightState === 'EW_GREEN') || (!isMovingNS && lightState === 'NS_GREEN')) {
          if (v.progress > 0.7) {
            v.stopped = true;
            continue;
          }
        }
      }

      v.stopped = false;
      v.progress += v.speed * dt;

      if (v.progress >= 1) {
        v.pathIndex++;
        if (v.pathIndex >= v.path.length - 1) {
          // Reached end, remove car
          this.vehicles.splice(i, 1);
          continue;
        }
        v.x = v.path[v.pathIndex].x;
        v.y = v.path[v.pathIndex].y;
        v.nextX = v.path[v.pathIndex + 1].x;
        v.nextY = v.path[v.pathIndex + 1].y;
        v.progress = 0;
      }
    }

    // Maintain car population
    const totalRoads = this.getAllRoads().length;
    const maxCars = Math.min(25, Math.max(4, Math.floor(totalRoads * 0.4)));
    if (this.vehicles.length < maxCars && Math.random() < 0.05) {
      this.spawnCar();
    }

    // Update emergency vehicles
    for (let i = this.emergencyVehicles.length - 1; i >= 0; i--) {
      const ev = this.emergencyVehicles[i];
      ev.flasher += dt * 8;
      ev.progress += ev.speed * dt;

      if (ev.progress >= 1) {
        ev.pathIndex++;
        if (ev.pathIndex >= ev.path.length - 1) {
          ev.arrived = true;
          // Arrived at destination
          ev.x = ev.targetX;
          ev.y = ev.targetY;
          // Stay for 3 seconds then disappear
          if (!ev.stayTimer) ev.stayTimer = 3.0;
          ev.stayTimer -= dt;
          if (ev.stayTimer <= 0) {
            this.emergencyVehicles.splice(i, 1);
          }
          continue;
        }
        ev.x = ev.path[ev.pathIndex].x;
        ev.y = ev.path[ev.pathIndex].y;
        ev.nextX = ev.path[ev.pathIndex + 1].x;
        ev.nextY = ev.path[ev.pathIndex + 1].y;
        ev.progress = 0;
      }
    }

    // Update pedestrians
    for (const p of this.pedestrians) {
      p.walkTime += dt * 5;
      const dx = p.targetX - p.x;
      const dy = p.targetY - p.y;
      const dist = Math.hypot(dx, dy);

      if (dist < 0.1) {
        // pick new target near current tile
        p.targetX = Math.max(0, Math.min(this.size - 1, p.x + (Math.random() - 0.5) * 1.5));
        p.targetY = Math.max(0, Math.min(this.size - 1, p.y + (Math.random() - 0.5) * 1.5));
      } else {
        p.x += (dx / dist) * p.speed * dt;
        p.y += (dy / dist) * p.speed * dt;
      }
    }
  }
}

window.BUILDING_TYPES = BUILDING_TYPES;
window.CityGrid = CityGrid;
