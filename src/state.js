(() => {
window.Sproutworks = window.Sproutworks || {};

const { CONFIG } = window.Sproutworks;
const SAVE_KEY = "sproutworks-save-v1";

const state = {
  resources: { ...CONFIG.resources },
  machines: [],
  items: [],
  effects: [],
  removedSources: [],
  buildMode: null,
  demolishMode: false,
  moveMode: false,
  harvestMode: false,
  sourceClearMode: false,
  harvestCooldown: 0,
  harvestAnimation: null,
  movingMachineId: null,
  moveRotation: 0,
  moveMirrored: false,
  buildRotation: 0,
  buildMirrored: false,
  saveDirty: false,
};

loadGame();

function saveGame() {
  try {
    const saveData = {
      version: 1,
      resources: { ...state.resources },
      removedSources: [...state.removedSources],
      machines: state.machines.map((machine) => ({
        id: machine.id,
        type: machine.type,
        tileX: machine.tileX,
        tileY: machine.tileY,
        x: machine.x,
        y: machine.y,
        widthTiles: machine.widthTiles,
        heightTiles: machine.heightTiles,
        rotation: machine.rotation,
        mirrored: Boolean(machine.mirrored),
        laneLevel: machine.laneLevel ?? 1,
        filterResource: machine.filterResource,
        passedCount: machine.passedCount ?? 0,
        productionTimer: machine.productionTimer ?? 0,
        outputTimer: machine.outputTimer ?? 0,
        outputIndex: machine.outputIndex ?? 0,
        storage: machine.storage ? { ...machine.storage } : undefined,
        active: false,
        connected: false,
      })),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
    state.saveDirty = false;
  } catch (error) {
    console.warn("Sproutworks konnte nicht gespeichert werden.", error);
  }
}

function loadGame() {
  try {
    const rawSave = localStorage.getItem(SAVE_KEY);
    if (!rawSave) return;

    const saveData = JSON.parse(rawSave);
    if (!saveData || saveData.version !== 1) return;

    state.resources = {
      ...CONFIG.resources,
      ...sanitizeResources(saveData.resources),
    };
    state.machines = Array.isArray(saveData.machines) ? saveData.machines.map(sanitizeMachine).filter(Boolean) : [];
    state.items = [];
    state.effects = [];
    state.removedSources = Array.isArray(saveData.removedSources) ? saveData.removedSources.filter((id) => typeof id === "string") : [];
    state.buildMode = null;
    state.demolishMode = false;
    state.moveMode = false;
    state.harvestMode = false;
    state.sourceClearMode = false;
    state.harvestCooldown = 0;
    state.harvestAnimation = null;
    state.movingMachineId = null;
    state.moveRotation = 0;
    state.moveMirrored = false;
    state.buildRotation = 0;
    state.buildMirrored = false;
    state.saveDirty = false;
  } catch (error) {
    console.warn("Sproutworks Spielstand konnte nicht geladen werden.", error);
  }
}

function markSaveDirty() {
  state.saveDirty = true;
}

function resetGame() {
  state.resources = { ...CONFIG.resources };
  state.machines = [];
  state.items = [];
  state.effects = [];
  state.removedSources = [];
  state.buildMode = null;
  state.demolishMode = false;
  state.moveMode = false;
  state.harvestMode = false;
  state.sourceClearMode = false;
  state.harvestCooldown = 0;
  state.harvestAnimation = null;
  state.movingMachineId = null;
  state.moveRotation = 0;
  state.moveMirrored = false;
  state.buildRotation = 0;
  state.buildMirrored = false;
  state.saveDirty = true;
  saveGame();
}

function sanitizeResources(resources) {
  const clean = {};
  Object.keys(CONFIG.resources).forEach((resource) => {
    const value = Number(resources?.[resource]);
    if (!Number.isFinite(value)) return;
    clean[resource] = resource === "coin"
      ? Math.max(0, Math.floor(value))
      : Math.min(CONFIG.storage.resourceMax, Math.max(0, Math.floor(value)));
  });
  return clean;
}

function sanitizeMachine(machine) {
  if (!machine || !CONFIG.machines[machine.type]) return null;
  const tileX = Math.floor(Number(machine.tileX));
  const tileY = Math.floor(Number(machine.tileY));
  if (!Number.isFinite(tileX) || !Number.isFinite(tileY)) return null;

  const footprint = {
    width: CONFIG.machines[machine.type].widthTiles ?? 1,
    height: CONFIG.machines[machine.type].heightTiles ?? 1,
  };
  return {
    id: typeof machine.id === "string" ? machine.id : `${machine.type}-${Date.now()}-${Math.random()}`,
    type: machine.type,
    tileX,
    tileY,
    x: tileX * CONFIG.world.tileSize + (CONFIG.world.tileSize * footprint.width) / 2,
    y: tileY * CONFIG.world.tileSize + (CONFIG.world.tileSize * footprint.height) / 2,
    widthTiles: footprint.width,
    heightTiles: footprint.height,
    rotation: Math.max(0, Math.floor(Number(machine.rotation) || 0)) % 4,
    mirrored: Boolean(machine.mirrored),
    laneLevel: Math.max(1, Math.min(CONFIG.machines.conveyorLaneUpgrade.maxLevel, Math.floor(Number(machine.laneLevel) || 1))),
    filterResource: sanitizeFilterResource(machine.filterResource),
    passedCount: Math.max(0, Math.floor(Number(machine.passedCount) || 0)),
    productionTimer: Number(machine.productionTimer) || 0,
    outputTimer: Number(machine.outputTimer) || 0,
    outputIndex: Math.max(0, Math.floor(Number(machine.outputIndex) || 0)),
    storage: sanitizeMachineStorage(machine.storage),
    active: false,
    connected: false,
  };
}

function sanitizeFilterResource(resource) {
  return ["wood", "stone", "iron"].includes(resource) ? resource : "wood";
}

function sanitizeMachineStorage(storage) {
  const clean = {};
  Object.keys(CONFIG.resources).forEach((resource) => {
    if (resource === "coin") return;
    const value = Number(storage?.[resource]);
    clean[resource] = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  });
  return clean;
}

window.Sproutworks.state = state;
window.Sproutworks.save = {
  key: SAVE_KEY,
  loadGame,
  markSaveDirty,
  resetGame,
  saveGame,
};
})();
