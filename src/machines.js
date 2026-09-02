(() => {
window.Sproutworks = window.Sproutworks || {};

const { CONFIG, state } = window.Sproutworks;
const DIRS = [
  { dx: 0, dy: -1 },
  { dx: 1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
];

function rotateBuildMode() {
  if (state.moveMode && state.movingMachineId) {
    state.moveRotation = (state.moveRotation + 1) % 4;
    return;
  }
  state.buildRotation = (state.buildRotation + 1) % 4;
}

function mirrorBuildMode() {
  if (state.moveMode && state.movingMachineId) {
    state.moveMirrored = !state.moveMirrored;
    return;
  }
  state.buildMirrored = !state.buildMirrored;
}

function createBuildable(type, tileX, tileY) {
  const footprint = getFootprint(type);
  const center = footprintCenter(tileX, tileY, footprint);
  const buildable = {
    id: window.crypto?.randomUUID ? window.crypto.randomUUID() : `${type}-${Date.now()}-${state.machines.length}`,
    type,
    tileX,
    tileY,
    x: center.x,
    y: center.y,
    widthTiles: footprint.width,
    heightTiles: footprint.height,
    rotation: state.buildRotation,
    mirrored: state.buildMirrored,
    laneLevel: isConveyorType(type) ? 1 : undefined,
    filterResource: type === "conveyorFilter" || type === "storageDepot" ? "wood" : undefined,
    passedCount: 0,
    productionTimer: 0,
    active: false,
    connected: false,
  };
  if (type === "storageUnit") {
    buildable.storage = createEmptyMachineStorage();
    buildable.outputTimer = 0;
    buildable.outputIndex = 0;
  }
  if (type === "storageDepot") buildable.status = "waiting";
  return buildable;
}

function updateMachines(delta) {
  state.machines.forEach((machine) => {
    const productionConfig = getProductionConfig(machine);
    if (!productionConfig) return;

    const route = getConveyorRoute(machine);
    const startConveyor = getStartingConveyor(machine);
    const hasSource = productionConfig.hasSource(machine.x, machine.y, productionConfig.range);
    machine.connected = route.reachesWarehouse;
    machine.active = hasSource && Boolean(startConveyor);
    machine.status = !hasSource ? "no-source" : !startConveyor ? "no-output" : "working";
    if (!machine.active) return;

    machine.productionTimer = Math.min(machine.productionTimer + delta, productionConfig.productionSeconds * 2);
    while (machine.productionTimer >= productionConfig.productionSeconds) {
      if (!canSpawnItemAt(startConveyor.conveyor, productionConfig.resource)) {
        machine.productionTimer = productionConfig.productionSeconds;
        machine.status = "blocked";
        break;
      }
      machine.productionTimer -= productionConfig.productionSeconds;
      spawnResourceItem(machine, startConveyor, productionConfig.resource, productionConfig.productionAmount);
    }
  });

  updateStorageUnits(delta);
  updateWarehouseOutputs(delta);
  updateStorageDepotOutputs(delta);
  updateItems(delta);
}

function canPlaceBuildable(type, worldX, worldY, ignoreId = null) {
  const tile = worldToTile(worldX, worldY);
  const machineConfig = CONFIG.machines[type];
  if (!machineConfig) return { ok: false, reason: "unknown-machine", tile };

  const footprint = getFootprint(type);
  const tiles = getFootprintTiles(tile.tileX, tile.tileY, footprint);
  if (tiles.some((spot) => !isTileInsideWorld(spot.tileX, spot.tileY))) return { ok: false, reason: "outside-map", tile };
  if (tiles.some((spot) => isWarehouseTile(spot.tileX, spot.tileY) || isWarehouseInputTile(spot.tileX, spot.tileY) || isWarehouseOutputTile(spot.tileX, spot.tileY) || isStoragePortTile(spot.tileX, spot.tileY, ignoreId) || isStorageDepotPortTile(spot.tileX, spot.tileY, ignoreId) || isStorageDepotOutputTile(spot.tileX, spot.tileY, ignoreId))) return { ok: false, reason: "warehouse", tile };
  if (tiles.some((spot) => {
    const machine = getMachineAtTile(spot.tileX, spot.tileY);
    return machine && machine.id !== ignoreId;
  })) return { ok: false, reason: "occupied", tile };
  if (tiles.some((spot) => isTileBlockedByNature(spot.tileX, spot.tileY))) return { ok: false, reason: "obstacle", tile };

  if (type === "storageUnit") {
    const placementRotation = state.moveMode && state.movingMachineId ? state.moveRotation : state.buildRotation;
    const ports = getStoragePorts({ type, tileX: tile.tileX, tileY: tile.tileY, rotation: placementRotation });
    if (Object.values(ports).some((port) => (
      !isTileInsideWorld(port.tileX, port.tileY)
      || isWarehouseTile(port.tileX, port.tileY)
      || isWarehouseInputTile(port.tileX, port.tileY)
      || isWarehouseOutputTile(port.tileX, port.tileY)
      || isTileBlockedByNature(port.tileX, port.tileY)
      || Boolean(getMachineAtTile(port.tileX, port.tileY))
      || isStoragePortTile(port.tileX, port.tileY, ignoreId)
    ))) return { ok: false, reason: "port-blocked", tile };
  }

  if (type === "storageDepot") {
    const placementRotation = state.moveMode && state.movingMachineId ? state.moveRotation : state.buildRotation;
    const ports = [
      ...getStorageDepotInputPorts({ type, tileX: tile.tileX, tileY: tile.tileY, rotation: placementRotation }),
      ...getStorageDepotOutputPorts({ type, tileX: tile.tileX, tileY: tile.tileY, rotation: placementRotation }),
    ];
    if (!isStorageDepotInWarehouseRange(tile.tileX, tile.tileY)) return { ok: false, reason: "warehouse-range", tile };
    if (ports.some((port) => (
      !isTileInsideWorld(port.tileX, port.tileY)
      || isWarehouseTile(port.tileX, port.tileY)
      || isWarehouseInputTile(port.tileX, port.tileY)
      || isWarehouseOutputTile(port.tileX, port.tileY)
      || isTileBlockedByNature(port.tileX, port.tileY)
      || Boolean(getMachineAtTile(port.tileX, port.tileY) && getMachineAtTile(port.tileX, port.tileY).id !== ignoreId)
      || isStoragePortTile(port.tileX, port.tileY, ignoreId)
      || isStorageDepotPortTile(port.tileX, port.tileY, ignoreId)
      || isStorageDepotOutputTile(port.tileX, port.tileY, ignoreId)
    ))) return { ok: false, reason: "port-blocked", tile };
  }

  const center = footprintCenter(tile.tileX, tile.tileY, footprint);
  const productionConfig = getProductionConfig({ type });
  if (productionConfig && !productionConfig.hasSource(center.x, center.y, productionConfig.range)) {
    return { ok: false, reason: "no-source", tile };
  }

  return { ok: true, tile };
}

function tryPlaceBuildable(type, worldX, worldY) {
  const machineConfig = CONFIG.machines[type];
  if (!machineConfig || !canAfford(machineConfig.cost)) return false;

  const placement = canPlaceBuildable(type, worldX, worldY);
  if (!placement.ok) return false;

  payCost(machineConfig.cost);
  state.machines.push(createBuildable(type, placement.tile.tileX, placement.tile.tileY));
  window.Sproutworks.save?.markSaveDirty();
  if (!isConveyorType(type) || !canAfford(machineConfig.cost)) {
    state.buildMode = null;
  }
  return true;
}

function getPlacementErrorMessage(type, worldX, worldY) {
  const machineConfig = CONFIG.machines[type];
  if (!machineConfig) return "Dieses Teil gibt es noch nicht.";
  if (!canAfford(machineConfig.cost)) return "Nicht genug Material.";

  const placement = canPlaceBuildable(type, worldX, worldY);
  return {
    "outside-map": "Das ist ausserhalb der Map.",
    warehouse: "Das Lager und seine Einfahrt muessen frei bleiben.",
    occupied: "Da steht schon etwas.",
    obstacle: "Baeume, Steine und Erze blockieren diese Kachel.",
    "port-blocked": "Ein- und Ausgang vom Lager brauchen freie Kacheln.",
    "no-source": "Diese Fabrik muss nah an der passenden Ressource stehen.",
    "warehouse-range": "Das Aussenlager muss in Reichweite vom Hauptlager stehen.",
  }[placement.reason] ?? "Hier kannst du das nicht platzieren.";
}

function getPlacementHintText(placement, type) {
  if (placement.ok) return `Baubar: ${getBuildName(type)}`;
  return {
    "outside-map": "Ausserhalb der Map",
    warehouse: "Lager bleibt frei",
    occupied: "Kachel belegt",
    obstacle: "Natur blockiert",
    "port-blocked": "Lager-Port blockiert",
    "no-source": "Naeher an Ressource",
    "warehouse-range": "Naeher ans Hauptlager",
  }[placement.reason] ?? "Nicht platzierbar";
}

function getBuildName(type) {
  return {
    woodCollector: "Holzfabrik",
    stoneCollector: "Steinfabrik",
    ironCollector: "Metallfabrik",
    conveyorStraight: "Foerderband",
    conveyorCorner: "Eckfoerderband",
    conveyorMerger: "Zusammenfuehrer",
    conveyorSplitter: "Splitter",
    conveyorPriority2: "2-Wege-Prioritaet",
    conveyorPriority3: "3-Wege-Prioritaet",
    conveyorConditional: "Bedingungsband",
    conveyorOverflow: "Ueberlauf-Band",
    conveyorFilter: "Filterband",
    storageUnit: "Lager",
    storageDepot: "Aussenlager",
    trashCan: "Muelleimer",
  }[type] ?? "Teil";
}

function demolishBuildableAt(worldX, worldY) {
  const tile = worldToTile(worldX, worldY);
  const machine = getMachineAtTile(tile.tileX, tile.tileY);
  if (!machine) return false;

  refundCost(CONFIG.machines[machine.type]?.cost ?? {});
  state.machines = state.machines.filter((item) => item.id !== machine.id);
  removeItemsTouchingMachine(machine);
  window.Sproutworks.save?.markSaveDirty();
  return true;
}

function harvestResourceAt(worldX, worldY) {
  if (state.harvestCooldown > 0) return false;

  const world = window.Sproutworks.world;
  const candidates = [
    ...world.trees.map((node) => ({ node, resource: "wood", radius: node.r * 0.9 })),
    ...world.rocks.map((node) => ({ node, resource: "stone", radius: node.r + 18 })),
    ...world.ironOres.map((node) => ({ node, resource: "iron", radius: node.r + 18 })),
  ];
  const target = candidates
    .map((candidate) => ({ ...candidate, distance: Math.hypot(worldX - candidate.node.x, worldY - candidate.node.y) }))
    .filter((candidate) => candidate.distance <= candidate.radius)
    .sort((a, b) => a.distance - b.distance)[0];
  if (!target) return false;

  const current = state.resources[target.resource] ?? 0;
  if (current >= CONFIG.storage.resourceMax) return false;
  state.resources[target.resource] = Math.min(CONFIG.storage.resourceMax, current + 1);
  state.harvestCooldown = 1;
  state.harvestAnimation = { resource: target.resource, x: target.node.x, y: target.node.y, time: 0 };
  addFloatingResourceText(target.resource, target.node.x, target.node.y - 44);
  window.Sproutworks.save?.markSaveDirty();
  return true;
}

function updateHarvestAnimation(delta) {
  if (!state.harvestAnimation) return;
  state.harvestAnimation.time += delta;
  if (state.harvestAnimation.time >= 0.42) state.harvestAnimation = null;
}

function drawHarvestAnimation(ctx, camera) {
  const animation = state.harvestAnimation;
  if (!animation) return;

  const progress = animation.time / 0.42;
  const swing = Math.sin(Math.min(1, progress) * Math.PI);
  ctx.save();
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x, -camera.y);
  ctx.translate(animation.x + 18, animation.y - 26);
  ctx.rotate(-0.78 + swing * 1.55);
  ctx.lineCap = "round";
  ctx.lineWidth = 7;
  ctx.strokeStyle = "#7a4a28";
  ctx.beginPath();
  ctx.moveTo(0, 12);
  ctx.lineTo(0, -26);
  ctx.stroke();
  ctx.lineWidth = 6;
  ctx.strokeStyle = animation.resource === "wood" ? "#d99a47" : animation.resource === "stone" ? "#b8c0c0" : "#d88455";
  ctx.beginPath();
  if (animation.resource === "wood") {
    ctx.moveTo(-10, -28);
    ctx.lineTo(10, -18);
  } else {
    ctx.moveTo(-11, -25);
    ctx.lineTo(11, -25);
  }
  ctx.stroke();
  ctx.restore();
}

function handleMoveToolAt(worldX, worldY) {
  if (!state.movingMachineId) {
    const machine = getMachineAtWorld(worldX, worldY);
    if (!machine) return false;
    state.movingMachineId = machine.id;
    state.moveRotation = machine.rotation;
    state.moveMirrored = Boolean(machine.mirrored);
    return true;
  }

  const machine = getMachineById(state.movingMachineId);
  if (!machine) {
    state.movingMachineId = null;
    return false;
  }

  const placement = canPlaceBuildable(machine.type, worldX, worldY, machine.id);
  if (!placement.ok) return false;

  const footprint = getFootprint(machine.type);
  const oldMachine = { ...machine, widthTiles: footprint.width, heightTiles: footprint.height };
  const center = footprintCenter(placement.tile.tileX, placement.tile.tileY, footprint);
  machine.tileX = placement.tile.tileX;
  machine.tileY = placement.tile.tileY;
  machine.x = center.x;
  machine.y = center.y;
  machine.widthTiles = footprint.width;
  machine.heightTiles = footprint.height;
  machine.rotation = state.moveRotation;
  machine.mirrored = state.moveMirrored;
  machine.productionTimer = 0;
  removeItemsAffectedByMove(oldMachine, machine);
  state.movingMachineId = null;
  state.moveRotation = 0;
  state.moveMirrored = false;
  window.Sproutworks.save?.markSaveDirty();
  return true;
}

function canAfford(cost) {
  return Object.entries(cost).every(([resource, amount]) => state.resources[resource] >= amount);
}

function payCost(cost) {
  Object.entries(cost).forEach(([resource, amount]) => {
    state.resources[resource] -= amount;
  });
}

function refundCost(cost) {
  Object.entries(cost).forEach(([resource, amount]) => {
    const refund = Math.ceil(amount / 2);
    if (resource === "coin") {
      state.resources[resource] += refund;
      return;
    }
    state.resources[resource] = Math.min(CONFIG.storage.resourceMax, state.resources[resource] + refund);
  });
}

function canUpgradeConveyorLanes(machine) {
  return Boolean(machine?.type && isConveyorType(machine.type));
}

function upgradeConveyorLanes(machine) {
  if (!canUpgradeConveyorLanes(machine)) return { ok: false, reason: "not-upgradable" };
  const upgradeConfig = CONFIG.machines.conveyorLaneUpgrade;
  const currentLevel = getConveyorLaneCapacity(machine);
  if (currentLevel >= upgradeConfig.maxLevel) return { ok: false, reason: "max" };
  if (!canAfford(upgradeConfig.cost)) return { ok: false, reason: "cost" };

  payCost(upgradeConfig.cost);
  machine.laneLevel = currentLevel + 1;
  window.Sproutworks.save?.markSaveDirty();
  return { ok: true, level: machine.laneLevel };
}

function refundAllBuildings() {
  state.machines.forEach((machine) => {
    Object.entries(CONFIG.machines[machine.type]?.cost ?? {}).forEach(([resource, amount]) => {
      state.resources[resource] = (state.resources[resource] ?? 0) + amount;
    });
  });
  state.machines = [];
  state.items = [];
  window.Sproutworks.save?.markSaveDirty();
}

function drawMachines(ctx, time) {
  state.machines.forEach((machine) => {
    if (machine.type === "woodCollector") drawWoodCollector(ctx, machine, time);
    if (machine.type === "stoneCollector") drawStoneCollector(ctx, machine, time);
    if (machine.type === "ironCollector") drawIronCollector(ctx, machine, time);
    if (machine.type === "storageUnit") drawStorageUnit(ctx, machine);
    if (machine.type === "storageDepot") drawStorageDepot(ctx, machine);
    if (machine.type === "trashCan") drawTrashCan(ctx, machine);
    if (isConveyor(machine)) drawConveyor(ctx, machine, time);
  });
  drawItems(ctx);
}

function drawBuildPreview(ctx, camera, pointerWorld, time) {
  if (!state.buildMode || !pointerWorld) return;

  const placement = canPlaceBuildable(state.buildMode, pointerWorld.x, pointerWorld.y);
  const tile = placement.tile ?? worldToTile(pointerWorld.x, pointerWorld.y);
  const footprint = getFootprint(state.buildMode);
  const center = footprintCenter(tile.tileX, tile.tileY, footprint);
  const preview = {
    type: state.buildMode,
    x: center.x,
    y: center.y,
    tileX: tile.tileX,
    tileY: tile.tileY,
    widthTiles: footprint.width,
    heightTiles: footprint.height,
    rotation: state.buildRotation,
    mirrored: state.buildMirrored,
    active: placement.ok,
    connected: false,
  };

  ctx.save();
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x, -camera.y);

  ctx.globalAlpha = 0.3;
  ctx.fillStyle = placement.ok ? "#63c65b" : "#e45a43";
  ctx.fillRect(
    tile.x - CONFIG.world.tileSize / 2,
    tile.y - CONFIG.world.tileSize / 2,
    CONFIG.world.tileSize * footprint.width,
    CONFIG.world.tileSize * footprint.height,
  );

  const productionConfig = getProductionConfig({ type: state.buildMode });
  if (productionConfig) {
    ctx.beginPath();
    ctx.arc(center.x, center.y, productionConfig.range, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 0.88;
  if (state.buildMode === "woodCollector") drawWoodCollector(ctx, preview, time);
  if (state.buildMode === "stoneCollector") drawStoneCollector(ctx, preview, time);
  if (state.buildMode === "ironCollector") drawIronCollector(ctx, preview, time);
  if (state.buildMode === "storageUnit") drawStorageUnit(ctx, preview);
  if (state.buildMode === "storageDepot") drawStorageDepot(ctx, preview);
  if (state.buildMode === "trashCan") drawTrashCan(ctx, preview);
  if (isConveyor(preview)) drawConveyor(ctx, preview, time);
  drawPlacementLabel(ctx, center.x, tile.y - 44, getPlacementHintText(placement, state.buildMode), placement.ok);

  ctx.restore();
}

function drawDemolishPreview(ctx, camera, pointerWorld) {
  if (!state.demolishMode || !pointerWorld) return;

  const tile = worldToTile(pointerWorld.x, pointerWorld.y);
  const machine = getMachineAtTile(tile.tileX, tile.tileY);
  if (!machine) return;

  const footprint = getFootprint(machine.type);
  ctx.save();
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x, -camera.y);
  ctx.globalAlpha = 0.36;
  ctx.fillStyle = "#e45a43";
  ctx.fillRect(
    machine.tileX * CONFIG.world.tileSize,
    machine.tileY * CONFIG.world.tileSize,
    CONFIG.world.tileSize * footprint.width,
    CONFIG.world.tileSize * footprint.height,
  );
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "#7d3329";
  ctx.lineWidth = 4;
  ctx.strokeRect(
    machine.tileX * CONFIG.world.tileSize + 2,
    machine.tileY * CONFIG.world.tileSize + 2,
    CONFIG.world.tileSize * footprint.width - 4,
    CONFIG.world.tileSize * footprint.height - 4,
  );
  ctx.restore();
}

function drawMovePreview(ctx, camera, pointerWorld, time) {
  if (!state.moveMode || !pointerWorld) return;

  const selected = state.movingMachineId ? getMachineById(state.movingMachineId) : getMachineAtWorld(pointerWorld.x, pointerWorld.y);
  if (!selected) return;

  const placement = state.movingMachineId
    ? canPlaceBuildable(selected.type, pointerWorld.x, pointerWorld.y, selected.id)
    : { ok: true, tile: { tileX: selected.tileX, tileY: selected.tileY } };
  const footprint = getFootprint(selected.type);
  const tile = placement.tile ?? worldToTile(pointerWorld.x, pointerWorld.y);
  const center = state.movingMachineId ? footprintCenter(tile.tileX, tile.tileY, footprint) : { x: selected.x, y: selected.y };
  const preview = {
    ...selected,
    x: center.x,
    y: center.y,
    tileX: state.movingMachineId ? tile.tileX : selected.tileX,
    tileY: state.movingMachineId ? tile.tileY : selected.tileY,
    rotation: state.movingMachineId ? state.moveRotation : selected.rotation,
    mirrored: state.movingMachineId ? state.moveMirrored : Boolean(selected.mirrored),
    active: placement.ok,
  };

  ctx.save();
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x, -camera.y);
  ctx.globalAlpha = state.movingMachineId ? 0.3 : 0.24;
  ctx.fillStyle = placement.ok ? "#63c65b" : "#e45a43";
  ctx.fillRect(
    preview.tileX * CONFIG.world.tileSize,
    preview.tileY * CONFIG.world.tileSize,
    CONFIG.world.tileSize * footprint.width,
    CONFIG.world.tileSize * footprint.height,
  );
  ctx.globalAlpha = 0.92;
  if (preview.type === "woodCollector") drawWoodCollector(ctx, preview, time);
  if (preview.type === "stoneCollector") drawStoneCollector(ctx, preview, time);
  if (preview.type === "ironCollector") drawIronCollector(ctx, preview, time);
  if (preview.type === "storageUnit") drawStorageUnit(ctx, preview);
  if (preview.type === "storageDepot") drawStorageDepot(ctx, preview);
  if (preview.type === "trashCan") drawTrashCan(ctx, preview);
  if (isConveyor(preview)) drawConveyor(ctx, preview, time);
  ctx.restore();
}

function worldToTile(x, y) {
  const tileX = Math.floor(x / CONFIG.world.tileSize);
  const tileY = Math.floor(y / CONFIG.world.tileSize);
  return { tileX, tileY, ...tileToWorld(tileX, tileY) };
}

function tileToWorld(tileX, tileY) {
  return {
    x: tileX * CONFIG.world.tileSize + CONFIG.world.tileSize / 2,
    y: tileY * CONFIG.world.tileSize + CONFIG.world.tileSize / 2,
  };
}

function isTileInsideWorld(tileX, tileY) {
  return tileX >= 0 && tileY >= 0 && tileX < CONFIG.world.width / CONFIG.world.tileSize && tileY < CONFIG.world.height / CONFIG.world.tileSize;
}

function getMachineAtTile(tileX, tileY) {
  return state.machines.find((machine) => {
    const footprint = getFootprint(machine.type);
    return (
      tileX >= machine.tileX &&
      tileX < machine.tileX + footprint.width &&
      tileY >= machine.tileY &&
      tileY < machine.tileY + footprint.height
    );
  });
}

function getMachineAtWorld(worldX, worldY) {
  const tile = worldToTile(worldX, worldY);
  return getMachineAtTile(tile.tileX, tile.tileY);
}

function getMachineById(id) {
  return state.machines.find((machine) => machine.id === id);
}

function isTileBlockedByNature(tileX, tileY) {
  const center = tileToWorld(tileX, tileY);
  return window.Sproutworks.world.obstacles.some((obstacle) => Math.hypot(center.x - obstacle.x, center.y - obstacle.y) < obstacle.r + 24);
}

function getWarehouseInputTile() {
  return getWarehouseInputTiles()[0];
}

function getWarehouseInputTiles() {
  const { warehouse } = window.Sproutworks.world;
  const size = CONFIG.world.tileSize;
  const left = Math.floor((warehouse.x - warehouse.width / 2) / size);
  const top = Math.floor((warehouse.y - 80) / size);
  const right = Math.floor((warehouse.x + warehouse.width / 2) / size);
  return [
    { tileX: left, tileY: top + 1, direction: 1 },
    { tileX: left, tileY: top + 2, direction: 1 },
    { tileX: right, tileY: top + 1, direction: 3 },
    { tileX: right, tileY: top + 2, direction: 3 },
  ];
}

function isWarehouseInputTile(tileX, tileY) {
  return getWarehouseInputTiles().some((input) => input.tileX === tileX && input.tileY === tileY);
}

function getWarehouseInputTargetAtTile(tileX, tileY) {
  return getWarehouseInputTiles().find((input) => input.tileX === tileX && input.tileY === tileY);
}

function getWarehouseOutputTiles() {
  const { warehouse } = window.Sproutworks.world;
  const size = CONFIG.world.tileSize;
  const left = Math.floor((warehouse.x - warehouse.width / 2) / size);
  const bottom = Math.floor((warehouse.y - 80 + warehouse.height) / size);
  return [
    { tileX: left + 2, tileY: bottom, direction: 2 },
    { tileX: left + 3, tileY: bottom, direction: 2 },
    { tileX: left + 4, tileY: bottom, direction: 2 },
    { tileX: left + 5, tileY: bottom, direction: 2 },
  ];
}

function isWarehouseOutputTile(tileX, tileY) {
  return getWarehouseOutputTiles().some((output) => output.tileX === tileX && output.tileY === tileY);
}

function isWarehouseTile(tileX, tileY) {
  const center = tileToWorld(tileX, tileY);
  const { warehouse } = window.Sproutworks.world;
  return (
    center.x >= warehouse.x - warehouse.width / 2 - 12 &&
    center.x <= warehouse.x + warehouse.width / 2 + 12 &&
    center.y >= warehouse.y - 80 - 12 &&
    center.y <= warehouse.y - 80 + warehouse.height + 12
  );
}

function createEmptyMachineStorage() {
  return Object.fromEntries(Object.keys(CONFIG.resources).filter((resource) => resource !== "coin").map((resource) => [resource, 0]));
}

function getStorageUnits() {
  return state.machines.filter((machine) => machine.type === "storageUnit");
}

function getStoragePorts(storage) {
  const rotation = storage.rotation % 4;
  const centerColumn = storage.tileX + 1;
  const centerRow = storage.tileY + 1;
  const ports = [
    {
      input: { tileX: centerColumn, tileY: storage.tileY - 1, direction: 2 },
      output: { tileX: centerColumn, tileY: storage.tileY + 2, direction: 2 },
    },
    {
      input: { tileX: storage.tileX + 3, tileY: centerRow, direction: 3 },
      output: { tileX: storage.tileX - 1, tileY: centerRow, direction: 3 },
    },
    {
      input: { tileX: centerColumn, tileY: storage.tileY + 2, direction: 0 },
      output: { tileX: centerColumn, tileY: storage.tileY - 1, direction: 0 },
    },
    {
      input: { tileX: storage.tileX - 1, tileY: centerRow, direction: 1 },
      output: { tileX: storage.tileX + 3, tileY: centerRow, direction: 1 },
    },
  ][rotation];
  return ports;
}

function getStorageInputTargetAtTile(tileX, tileY) {
  return getStorageUnits().map((storage) => ({ storage, input: getStoragePorts(storage).input }))
    .find(({ input }) => input.tileX === tileX && input.tileY === tileY);
}

function getStorageOutputTargetAtTile(tileX, tileY) {
  return getStorageUnits().map((storage) => ({ storage, output: getStoragePorts(storage).output }))
    .find(({ output }) => output.tileX === tileX && output.tileY === tileY);
}

function getStorageDepots() {
  return state.machines.filter((machine) => machine.type === "storageDepot");
}

function getStorageDepotInputPorts(depot) {
  const rotation = depot.rotation % 4;
  const ports = [
    [
      { tileX: depot.tileX + 1, tileY: depot.tileY, direction: 2 },
      { tileX: depot.tileX + 2, tileY: depot.tileY, direction: 2 },
    ],
    [
      { tileX: depot.tileX + 3, tileY: depot.tileY + 1, direction: 3 },
      { tileX: depot.tileX + 3, tileY: depot.tileY + 2, direction: 3 },
    ],
    [
      { tileX: depot.tileX + 1, tileY: depot.tileY + 2, direction: 0 },
      { tileX: depot.tileX + 2, tileY: depot.tileY + 2, direction: 0 },
    ],
    [
      { tileX: depot.tileX, tileY: depot.tileY + 1, direction: 1 },
      { tileX: depot.tileX, tileY: depot.tileY + 2, direction: 1 },
    ],
  ];
  return ports[rotation];
}

function getStorageDepotOutputPorts(depot) {
  return [
    { tileX: depot.tileX + 1, tileY: depot.tileY + 3, direction: 2 },
    { tileX: depot.tileX + 2, tileY: depot.tileY + 3, direction: 2 },
  ];
}

function getStorageDepotInputTargetAtTile(tileX, tileY) {
  return getStorageDepots()
    .flatMap((depot) => getStorageDepotInputPorts(depot).map((input) => ({ depot, input })))
    .find(({ input }) => input.tileX === tileX && input.tileY === tileY);
}

function isStorageDepotPortTile(tileX, tileY, ignoreId = null) {
  return getStorageDepots().some((depot) => {
    if (depot.id === ignoreId) return false;
    return getStorageDepotInputPorts(depot).some((input) => input.tileX === tileX && input.tileY === tileY);
  });
}

function isStorageDepotOutputTile(tileX, tileY, ignoreId = null) {
  return getStorageDepots().some((depot) => {
    if (depot.id === ignoreId) return false;
    return getStorageDepotOutputPorts(depot).some((output) => output.tileX === tileX && output.tileY === tileY);
  });
}

function getWarehouseCenterPoint() {
  const { warehouse } = window.Sproutworks.world;
  return { x: warehouse.x, y: warehouse.y - 80 + warehouse.height / 2 };
}

function isStorageDepotInWarehouseRange(tileX, tileY) {
  const footprint = getFootprint("storageDepot");
  const center = footprintCenter(tileX, tileY, footprint);
  const warehouseCenter = getWarehouseCenterPoint();
  return Math.hypot(center.x - warehouseCenter.x, center.y - warehouseCenter.y) <= CONFIG.storage.depotRange;
}

function isStoragePortTile(tileX, tileY, ignoreId = null) {
  return getStorageUnits().some((storage) => {
    if (storage.id === ignoreId) return false;
    const ports = getStoragePorts(storage);
    return (
      (ports.input.tileX === tileX && ports.input.tileY === tileY)
      || (ports.output.tileX === tileX && ports.output.tileY === tileY)
    );
  });
}

function getStorageFill(storage) {
  return Object.values(storage.storage ?? {}).reduce((sum, value) => sum + value, 0);
}

function canStoreInStorageUnit(storage, resource = null) {
  if (!resource) return getStorageFill(storage) < CONFIG.storage.unitMax * (Object.keys(CONFIG.resources).length - 1);
  return (storage.storage?.[resource] ?? 0) < CONFIG.storage.unitMax;
}

function canStoreInStorageDepot(depot, resource) {
  return depot.filterResource === resource && canStoreResource(resource);
}

function storeInStorageDepot(depot, resource) {
  if (!canStoreInStorageDepot(depot, resource)) {
    depot.status = depot.filterResource === resource ? "blocked" : "wrong-item";
    return false;
  }
  deliverResource(resource);
  depot.status = "working";
  return true;
}

function storeInStorageUnit(storage, resource) {
  if (!storage.storage) storage.storage = createEmptyMachineStorage();
  if (!canStoreInStorageUnit(storage, resource)) return false;
  storage.storage[resource] = (storage.storage[resource] ?? 0) + 1;
  return true;
}

function hasTreeInRange(x, y, range) {
  return window.Sproutworks.world.trees.some((tree) => Math.hypot(x - tree.x, y - tree.y) <= range + tree.r * 0.45);
}

function hasRockInRange(x, y, range) {
  return window.Sproutworks.world.rocks.some((rock) => Math.hypot(x - rock.x, y - rock.y) <= range + rock.r);
}

function hasIronOreInRange(x, y, range) {
  return window.Sproutworks.world.ironOres.some((ore) => Math.hypot(x - ore.x, y - ore.y) <= range + ore.r);
}

function getProductionConfig(machine) {
  if (machine.type === "woodCollector") {
    return {
      resource: "wood",
      range: CONFIG.machines.woodCollector.range,
      productionAmount: CONFIG.machines.woodCollector.productionAmount,
      productionSeconds: CONFIG.machines.woodCollector.productionSeconds,
      hasSource: hasTreeInRange,
    };
  }

  if (machine.type === "stoneCollector") {
    return {
      resource: "stone",
      range: CONFIG.machines.stoneCollector.range,
      productionAmount: CONFIG.machines.stoneCollector.productionAmount,
      productionSeconds: CONFIG.machines.stoneCollector.productionSeconds,
      hasSource: hasRockInRange,
    };
  }

  if (machine.type === "ironCollector") {
    return {
      resource: "iron",
      range: CONFIG.machines.ironCollector.range,
      productionAmount: CONFIG.machines.ironCollector.productionAmount,
      productionSeconds: CONFIG.machines.ironCollector.productionSeconds,
      hasSource: hasIronOreInRange,
    };
  }

  return null;
}

function getConveyorRoute(machine) {
  const queue = getAdjacentConveyorsForMachine(machine)
    .filter(({ conveyor, directionFromConveyor }) => getConveyorInputs(conveyor).includes(directionFromConveyor))
    .map(({ conveyor }) => ({ conveyor, path: [pointFromMachine(machine), pointFromMachine(conveyor)] }));
  const seen = new Set();
  let fallbackPath = [];

  while (queue.length > 0) {
    const { conveyor, path } = queue.shift();
    const key = tileKey(conveyor.tileX, conveyor.tileY);
    if (seen.has(key)) continue;
    seen.add(key);
    fallbackPath = path;

    for (const dirIndex of getConveyorOutputs(conveyor)) {
      const dir = DIRS[dirIndex];
      const nextTileX = conveyor.tileX + dir.dx;
      const nextTileY = conveyor.tileY + dir.dy;
      const warehouseInput = getWarehouseInputTargetAtTile(nextTileX, nextTileY);
      if (warehouseInput) {
        return { path: [...path, tileToWorld(warehouseInput.tileX, warehouseInput.tileY)], reachesWarehouse: true };
      }
      if (getStorageInputTargetAtTile(nextTileX, nextTileY)) {
        return { path: [...path, tileToWorld(nextTileX, nextTileY)], reachesWarehouse: true };
      }
      if (getStorageDepotInputTargetAtTile(nextTileX, nextTileY)) {
        return { path: [...path, tileToWorld(nextTileX, nextTileY)], reachesWarehouse: true };
      }

      const nextMachine = getMachineAtTile(nextTileX, nextTileY);
      if (!nextMachine || !isConveyor(nextMachine)) continue;
      if (getConveyorInputs(nextMachine).includes(oppositeDir(dirIndex))) {
        queue.push({ conveyor: nextMachine, path: [...path, pointFromMachine(nextMachine)] });
      }
    }
  }

  return { path: fallbackPath, reachesWarehouse: false };
}

function getStartingConveyor(machine) {
  return getAdjacentConveyorsForMachine(machine)
    .find(({ conveyor, directionFromConveyor }) => getConveyorInputs(conveyor).includes(directionFromConveyor));
}

function getAdjacentConveyorsForMachine(machine) {
  const footprint = getFootprint(machine.type);
  const edgeTiles = getFootprintTiles(machine.tileX, machine.tileY, footprint);
  const candidates = [];

  edgeTiles.forEach((tile) => {
    DIRS.forEach((dir, directionFromMachine) => {
      const nextTileX = tile.tileX + dir.dx;
      const nextTileY = tile.tileY + dir.dy;
      const insideFootprint = edgeTiles.some((spot) => spot.tileX === nextTileX && spot.tileY === nextTileY);
      if (insideFootprint) return;

      const conveyor = getMachineAtTile(nextTileX, nextTileY);
      if (!conveyor || !isConveyor(conveyor)) return;
      candidates.push({ conveyor, directionFromConveyor: oppositeDir(directionFromMachine) });
    });
  });

  return candidates;
}

function getAdjacentConveyors(tileX, tileY) {
  return DIRS.flatMap((dir, directionFromMachine) => {
    const conveyor = getMachineAtTile(tileX + dir.dx, tileY + dir.dy);
    if (!conveyor || !isConveyor(conveyor)) return [];
    return [{ conveyor, directionFromConveyor: oppositeDir(directionFromMachine) }];
  });
}

function getConveyorConnections(conveyor) {
  return [...new Set([...getConveyorInputs(conveyor), ...getConveyorOutputs(conveyor)])];
}

function getConveyorInputs(conveyor) {
  const rotation = conveyor.rotation % 4;
  if (conveyor.type === "conveyorStraight") return [rotateDir(3, rotation)];
  if (conveyor.type === "conveyorConditional") return [rotateDir(3, rotation)];
  if (conveyor.type === "conveyorOverflow") return [rotateDir(3, rotation)];
  if (conveyor.type === "conveyorFilter") return [rotateDir(3, rotation)];
  if (conveyor.type === "conveyorCorner") return [rotateDir(conveyor.mirrored ? 2 : 0, rotation)];
  if (conveyor.type === "conveyorMerger") return rotateDirs([3, 0, 2], rotation);
  if (conveyor.type === "conveyorSplitter") return [rotateDir(3, rotation)];
  if (conveyor.type === "conveyorPriority2") return [rotateDir(3, rotation)];
  if (conveyor.type === "conveyorPriority3") return [rotateDir(3, rotation)];
  return [];
}

function getConveyorOutputs(conveyor) {
  const rotation = conveyor.rotation % 4;
  if (conveyor.type === "conveyorStraight") return [rotateDir(1, rotation)];
  if (conveyor.type === "conveyorConditional") return [rotateDir(1, rotation)];
  if (conveyor.type === "conveyorOverflow") return [rotateDir(1, rotation)];
  if (conveyor.type === "conveyorFilter") return [rotateDir(1, rotation)];
  if (conveyor.type === "conveyorCorner") return [rotateDir(1, rotation)];
  if (conveyor.type === "conveyorMerger") return [rotateDir(1, rotation)];
  if (conveyor.type === "conveyorSplitter") return rotateDirs([1, 0, 2], rotation);
  if (conveyor.type === "conveyorPriority2") return rotateDirs([conveyor.mirrored ? 0 : 2, 1], rotation);
  if (conveyor.type === "conveyorPriority3") return rotateDirs([0, 2, 1], rotation);
  return [];
}

function isConveyor(machine) {
  return isConveyorType(machine.type);
}

function isConveyorType(type) {
  return type === "conveyorStraight" || type === "conveyorCorner" || type === "conveyorMerger" || type === "conveyorSplitter" || type === "conveyorPriority2" || type === "conveyorPriority3" || type === "conveyorConditional" || type === "conveyorOverflow" || type === "conveyorFilter";
}

function oppositeDir(dirIndex) {
  return (dirIndex + 2) % 4;
}

function rotateDirs(dirs, rotation) {
  return dirs.map((dir) => rotateDir(dir, rotation));
}

function rotateDir(dir, rotation) {
  return (dir + rotation) % 4;
}

function canConditionalConveyorPass(conveyor, resource) {
  const target = findStorageTargetAfterConveyor(conveyor);
  if (!target) return true;
  const hasSpace = targetHasSpaceForResource(target, resource);
  if (conveyor.type === "conveyorOverflow") return !hasSpace;
  return hasSpace;
}

function canItemEnterMachineFromDirection(machine, inputDirection, resource) {
  if (!getConveyorInputs(machine).includes(inputDirection)) return false;
  if (machine.type === "conveyorFilter" && machine.filterResource !== resource) return false;
  if ((machine.type === "conveyorConditional" || machine.type === "conveyorOverflow") && !canConditionalConveyorPass(machine, resource)) return false;
  return true;
}

function targetHasSpaceForResource(target, resource) {
  if (target.type === "warehouse") return canStoreResource(resource);
  if (target.type === "storageUnit") return canStoreInStorageUnit(target.storage, resource);
  if (target.type === "storageDepot") return canStoreInStorageDepot(target.depot, resource);
  return true;
}

function findStorageTargetAfterConveyor(startConveyor) {
  const queue = [{ conveyor: startConveyor }];
  const seen = new Set();

  while (queue.length > 0) {
    const { conveyor } = queue.shift();
    const key = tileKey(conveyor.tileX, conveyor.tileY);
    if (seen.has(key)) continue;
    seen.add(key);

    for (const dirIndex of getConveyorOutputs(conveyor)) {
      const dir = DIRS[dirIndex];
      const nextTileX = conveyor.tileX + dir.dx;
      const nextTileY = conveyor.tileY + dir.dy;
      if (getWarehouseInputTargetAtTile(nextTileX, nextTileY)) {
        return { type: "warehouse" };
      }

      const storageInput = getStorageInputTargetAtTile(nextTileX, nextTileY);
      if (storageInput) return { type: "storageUnit", storage: storageInput.storage };

      const depotInput = getStorageDepotInputTargetAtTile(nextTileX, nextTileY);
      if (depotInput) return { type: "storageDepot", depot: depotInput.depot };

      const nextMachine = getMachineAtTile(nextTileX, nextTileY);
      if (!nextMachine || !isConveyor(nextMachine)) continue;
      if (!getConveyorInputs(nextMachine).includes(oppositeDir(dirIndex))) continue;
      queue.push({ conveyor: nextMachine });
    }
  }

  return null;
}

function tileKey(tileX, tileY) {
  return `${tileX},${tileY}`;
}

function pointFromMachine(machine) {
  return { x: machine.x, y: machine.y };
}

function isTrashCanTile(tileX, tileY) {
  return state.machines.some((machine) => (
    machine.type === "trashCan"
    && machine.tileX === tileX
    && machine.tileY === tileY
  ));
}

function spawnResourceItem(machine, startConveyor, resource, amount) {
  for (let i = 0; i < amount; i += 1) {
    const lane = getFirstFreeLane(startConveyor.conveyor.tileX, startConveyor.conveyor.tileY, null, buildItemTileOccupancy());
    if (lane === -1) return;
    countGatePass(startConveyor.conveyor);
    state.items.push({
      type: resource,
      path: [pointFromMachine(machine), pointFromMachine(startConveyor.conveyor)],
      previousTile: { tileX: machine.tileX, tileY: machine.tileY },
      currentTile: { tileX: startConveyor.conveyor.tileX, tileY: startConveyor.conveyor.tileY },
      lane,
      segment: 0,
      progress: 0,
      speed: 95,
      x: machine.x,
      y: machine.y,
    });
  }
}

function updateStorageUnits(delta) {
  getStorageUnits().forEach((storage) => {
    if (!storage.storage) storage.storage = createEmptyMachineStorage();
    const output = getStorageOutputConveyor(storage);
    storage.active = Boolean(output) && getStorageFill(storage) > 0;
    storage.status = getStorageFill(storage) <= 0 ? "empty" : !output ? "no-output" : "working";
    if (!storage.active) return;

    storage.outputTimer = (storage.outputTimer ?? 0) + delta;
    while (storage.outputTimer >= CONFIG.machines.storageUnit.outputSeconds) {
      const outputAmount = getConveyorLaneCapacity(output.conveyor);
      let spawned = 0;
      let blocked = false;

      for (let i = 0; i < outputAmount; i += 1) {
        const resource = takeStorageOutputResource(storage);
        if (!resource) break;

        if (!canSpawnItemAt(output.conveyor, resource)) {
          storage.storage[resource] = (storage.storage[resource] ?? 0) + 1;
          blocked = true;
          break;
        }

        spawnStoredResourceItem(storage, output, resource);
        spawned += 1;
      }

      if (spawned > 0) {
        storage.outputTimer -= CONFIG.machines.storageUnit.outputSeconds;
        window.Sproutworks.save?.markSaveDirty();
        continue;
      }

      if (blocked) {
        storage.outputTimer = CONFIG.machines.storageUnit.outputSeconds;
        storage.status = "blocked";
        break;
      }

      storage.outputTimer = 0;
      break;
    }
  });
}

function updateWarehouseOutputs(delta) {
  if (!state.warehouseOutputEnabled) return;
  const outputs = getWarehouseOutputConveyors();
  if (outputs.length === 0) return;

  state.warehouseOutputTimer = (state.warehouseOutputTimer ?? 0) + delta;
  while (state.warehouseOutputTimer >= CONFIG.storage.outputSeconds) {
    let spawned = 0;
    outputs.forEach((output) => {
      const amount = getConveyorLaneCapacity(output.conveyor);
      for (let i = 0; i < amount; i += 1) {
        const resource = takeWarehouseOutputResource();
        if (!resource) return;
        if (!canSpawnItemAt(output.conveyor, resource)) {
          state.resources[resource] = (state.resources[resource] ?? 0) + 1;
          return;
        }
        spawnOutputResourceItem(output.output, output.conveyor, resource);
        spawned += 1;
      }
    });

    if (spawned <= 0) {
      state.warehouseOutputTimer = CONFIG.storage.outputSeconds;
      break;
    }
    state.warehouseOutputTimer -= CONFIG.storage.outputSeconds;
    window.Sproutworks.save?.markSaveDirty();
  }
}

function updateStorageDepotOutputs(delta) {
  getStorageDepots().forEach((depot) => {
    const outputs = getStorageDepotOutputConveyors(depot);
    depot.active = outputs.length > 0;
    if (!depot.active) return;

    depot.outputTimer = (depot.outputTimer ?? 0) + delta;
    while (depot.outputTimer >= CONFIG.storage.outputSeconds) {
      const resource = depot.filterResource ?? "wood";
      let spawned = 0;
      outputs.forEach((output) => {
        const amount = getConveyorLaneCapacity(output.conveyor);
        for (let i = 0; i < amount; i += 1) {
          if ((state.resources[resource] ?? 0) <= 0) return;
          if (!canSpawnItemAt(output.conveyor, resource)) return;
          state.resources[resource] -= 1;
          spawnOutputResourceItem(output.output, output.conveyor, resource);
          spawned += 1;
        }
      });

      if (spawned <= 0) {
        depot.status = (state.resources[resource] ?? 0) <= 0 ? "empty" : "blocked";
        depot.outputTimer = CONFIG.storage.outputSeconds;
        break;
      }
      depot.status = "working";
      depot.outputTimer -= CONFIG.storage.outputSeconds;
      window.Sproutworks.save?.markSaveDirty();
    }
  });
}

function getWarehouseOutputConveyors() {
  return getWarehouseOutputTiles().flatMap((output) => {
    const dir = DIRS[output.direction];
    const tile = {
      tileX: output.tileX + dir.dx,
      tileY: output.tileY + dir.dy,
    };
    const conveyor = getMachineAtTile(tile.tileX, tile.tileY);
    if (!conveyor || !isConveyor(conveyor)) return [];
    if (!getConveyorInputs(conveyor).includes(oppositeDir(output.direction))) return [];
    return [{ conveyor, output, tile }];
  });
}

function getStorageDepotOutputConveyors(depot) {
  return getStorageDepotOutputPorts(depot).flatMap((output) => {
    const dir = DIRS[output.direction];
    const tile = {
      tileX: output.tileX + dir.dx,
      tileY: output.tileY + dir.dy,
    };
    const conveyor = getMachineAtTile(tile.tileX, tile.tileY);
    if (!conveyor || !isConveyor(conveyor)) return [];
    if (!getConveyorInputs(conveyor).includes(oppositeDir(output.direction))) return [];
    return [{ conveyor, output, tile }];
  });
}

function getStorageOutputConveyor(storage) {
  const output = getStoragePorts(storage).output;
  const dir = DIRS[output.direction];
  const tile = {
    tileX: output.tileX + dir.dx,
    tileY: output.tileY + dir.dy,
  };
  const conveyor = getMachineAtTile(tile.tileX, tile.tileY);
  if (!conveyor || !isConveyor(conveyor)) return null;
  if (!getConveyorInputs(conveyor).includes(oppositeDir(output.direction))) return null;
  return { conveyor, output, tile };
}

function takeWarehouseOutputResource() {
  const resources = Object.keys(CONFIG.resources).filter((resource) => resource !== "coin");
  const selected = state.warehouseOutputResource ?? "auto";
  if (selected !== "auto") {
    if ((state.resources?.[selected] ?? 0) <= 0) return null;
    state.resources[selected] -= 1;
    return selected;
  }
  for (let i = 0; i < resources.length; i += 1) {
    const index = ((state.warehouseOutputIndex ?? 0) + i) % resources.length;
    const resource = resources[index];
    if ((state.resources?.[resource] ?? 0) <= 0) continue;
    state.resources[resource] -= 1;
    state.warehouseOutputIndex = (index + 1) % resources.length;
    return resource;
  }
  return null;
}

function takeStorageOutputResource(storage) {
  const resources = Object.keys(CONFIG.resources).filter((resource) => resource !== "coin");
  for (let i = 0; i < resources.length; i += 1) {
    const index = ((storage.outputIndex ?? 0) + i) % resources.length;
    const resource = resources[index];
    if ((storage.storage?.[resource] ?? 0) <= 0) continue;
    storage.storage[resource] -= 1;
    storage.outputIndex = (index + 1) % resources.length;
    return resource;
  }
  return null;
}

function spawnOutputResourceItem(outputPort, conveyor, resource) {
  const outputPoint = tileToWorld(outputPort.tileX, outputPort.tileY);
  const lane = getFirstFreeLane(conveyor.tileX, conveyor.tileY, null, buildItemTileOccupancy());
  if (lane === -1) return;
  countGatePass(conveyor);
  state.items.push({
    type: resource,
    path: [outputPoint, pointFromMachine(conveyor)],
    previousTile: { tileX: outputPort.tileX, tileY: outputPort.tileY },
    currentTile: { tileX: conveyor.tileX, tileY: conveyor.tileY },
    lane,
    segment: 0,
    progress: 0,
    speed: 95,
    x: outputPoint.x,
    y: outputPoint.y,
  });
}

function spawnStoredResourceItem(storage, output, resource) {
  const outputPoint = tileToWorld(output.output.tileX, output.output.tileY);
  const lane = getFirstFreeLane(output.conveyor.tileX, output.conveyor.tileY, null, buildItemTileOccupancy());
  if (lane === -1) return;
  countGatePass(output.conveyor);
  state.items.push({
    type: resource,
    path: [outputPoint, pointFromMachine(output.conveyor)],
    previousTile: { tileX: output.output.tileX, tileY: output.output.tileY },
    currentTile: { tileX: output.conveyor.tileX, tileY: output.conveyor.tileY },
    lane,
    segment: 0,
    progress: 0,
    speed: 95,
    x: outputPoint.x,
    y: outputPoint.y,
  });
}

function updateItems(delta) {
  removeDuplicateWaitingItems();
  const occupiedTiles = buildItemTileOccupancy();

  for (let i = 0; i < state.items.length; i += 1) {
    const item = state.items[i];
    if (!isItemRouteStillValid(item)) {
      releaseItemTile(item, occupiedTiles);
      state.items.splice(i, 1);
      i -= 1;
      continue;
    }

    let remaining = item.speed * delta;
    let removeItem = false;
    let deliverItem = false;

    while (remaining > 0 && item.segment < item.path.length - 1) {
      const from = item.path[item.segment];
      const to = item.path[item.segment + 1];
      const segmentLength = Math.max(1, Math.hypot(to.x - from.x, to.y - from.y));
      const distanceLeft = segmentLength * (1 - item.progress);

      if (remaining >= distanceLeft) {
        remaining -= distanceLeft;
        item.segment += 1;
        item.progress = 0;
        if (item.segment >= item.path.length - 1) {
          const nextStep = updateItemRouteAtConveyor(item, occupiedTiles);
          if (nextStep === "deliver") {
            deliverItem = true;
            break;
          }
          if (nextStep === "stored") {
            window.Sproutworks.save?.markSaveDirty();
            removeItem = true;
            break;
          }
          if (nextStep === "remove") {
            removeItem = true;
            break;
          }
          if (nextStep === "trash") {
            removeItem = true;
            break;
          }
          if (nextStep === "wait") {
            placeItemAtWaitPoint(item);
            break;
          }
        }
      } else {
        const nextProgress = item.progress + remaining / segmentLength;
        item.progress = nextProgress;
        remaining = 0;
      }
    }

    if (deliverItem) {
      deliverResourceItem(item);
      window.Sproutworks.save?.markSaveDirty();
      releaseItemTile(item, occupiedTiles);
      state.items.splice(i, 1);
      i -= 1;
      continue;
    }

    if (removeItem) {
      releaseItemTile(item, occupiedTiles);
      state.items.splice(i, 1);
      i -= 1;
      continue;
    }

    if (item.segment >= item.path.length - 1) {
      const nextStep = updateItemRouteAtConveyor(item, occupiedTiles);
      if (nextStep === "deliver") {
        deliverResourceItem(item);
        window.Sproutworks.save?.markSaveDirty();
        releaseItemTile(item, occupiedTiles);
        state.items.splice(i, 1);
        i -= 1;
        continue;
      }
      if (nextStep === "stored") {
        window.Sproutworks.save?.markSaveDirty();
        releaseItemTile(item, occupiedTiles);
        state.items.splice(i, 1);
        i -= 1;
        continue;
      }
      if (nextStep === "trash") {
        releaseItemTile(item, occupiedTiles);
        state.items.splice(i, 1);
        i -= 1;
        continue;
      }
      if (nextStep === "wait") {
        placeItemAtWaitPoint(item);
        continue;
      }
      if (nextStep !== "continue") {
        releaseItemTile(item, occupiedTiles);
        state.items.splice(i, 1);
        i -= 1;
        continue;
      }
    }

    const from = item.path[item.segment];
    const to = item.path[item.segment + 1];
    item.x = from.x + (to.x - from.x) * item.progress;
    item.y = from.y + (to.y - from.y) * item.progress;
  }
}

function updateItemRouteAtConveyor(item, occupiedTiles = buildItemTileOccupancy()) {
  const currentTile = item.currentTile;
  if (!currentTile) return "remove";
  if (isTrashCanTile(currentTile.tileX, currentTile.tileY)) return "trash";

  const currentWarehouseInput = getWarehouseInputTargetAtTile(currentTile.tileX, currentTile.tileY);
  if (currentWarehouseInput) {
    return canStoreResource(item.type) ? "deliver" : "wait";
  }

  const storageInput = getStorageInputTargetAtTile(currentTile.tileX, currentTile.tileY);
  if (storageInput) {
    return storeInStorageUnit(storageInput.storage, item.type) ? "stored" : "wait";
  }

  const depotInput = getStorageDepotInputTargetAtTile(currentTile.tileX, currentTile.tileY);
  if (depotInput) {
    return storeInStorageDepot(depotInput.depot, item.type) ? "stored" : "wait";
  }

  const conveyor = getMachineAtTile(currentTile.tileX, currentTile.tileY);
  if (!conveyor || !isConveyor(conveyor)) return "remove";
  item.waiting = false;

  const outputs = getConveyorOutputs(conveyor);
  const previousKey = item.previousTile ? tileKey(item.previousTile.tileX, item.previousTile.tileY) : "";
  const candidates = [];

  for (const dirIndex of outputs) {
    const dir = DIRS[dirIndex];
    const nextTile = {
      tileX: currentTile.tileX + dir.dx,
      tileY: currentTile.tileY + dir.dy,
    };

    const warehouseInput = getWarehouseInputTargetAtTile(nextTile.tileX, nextTile.tileY);
    if (warehouseInput) {
      if (!canStoreResource(item.type)) continue;
      if (!isLaneAvailableForItem(nextTile.tileX, nextTile.tileY, item, occupiedTiles)) continue;
      item.path.push(tileToWorld(warehouseInput.tileX, warehouseInput.tileY));
      reserveItemTile(item, currentTile, warehouseInput, occupiedTiles);
      item.previousTile = { ...currentTile };
      item.currentTile = { tileX: warehouseInput.tileX, tileY: warehouseInput.tileY };
      item.segment = item.path.length - 2;
      item.progress = 0;
      return "continue";
    }

    if (getStorageInputTargetAtTile(nextTile.tileX, nextTile.tileY)) {
      const storageInput = getStorageInputTargetAtTile(nextTile.tileX, nextTile.tileY);
      if (!canStoreInStorageUnit(storageInput.storage, item.type)) continue;
      if (!isLaneAvailableForItem(nextTile.tileX, nextTile.tileY, item, occupiedTiles)) continue;
      item.path.push(tileToWorld(nextTile.tileX, nextTile.tileY));
      reserveItemTile(item, currentTile, nextTile, occupiedTiles);
      item.previousTile = { ...currentTile };
      item.currentTile = { ...nextTile };
      item.segment = item.path.length - 2;
      item.progress = 0;
      return "continue";
    }

    if (getStorageDepotInputTargetAtTile(nextTile.tileX, nextTile.tileY)) {
      const depotInput = getStorageDepotInputTargetAtTile(nextTile.tileX, nextTile.tileY);
      if (!canStoreInStorageDepot(depotInput.depot, item.type)) continue;
      if (!isLaneAvailableForItem(nextTile.tileX, nextTile.tileY, item, occupiedTiles)) continue;
      item.path.push(tileToWorld(nextTile.tileX, nextTile.tileY));
      reserveItemTile(item, currentTile, nextTile, occupiedTiles);
      item.previousTile = { ...currentTile };
      item.currentTile = { ...nextTile };
      item.segment = item.path.length - 2;
      item.progress = 0;
      return "continue";
    }

    if (isTrashCanTile(nextTile.tileX, nextTile.tileY)) {
      if (!isLaneAvailableForItem(nextTile.tileX, nextTile.tileY, item, occupiedTiles)) continue;
      item.path.push(tileToWorld(nextTile.tileX, nextTile.tileY));
      reserveItemTile(item, currentTile, nextTile, occupiedTiles);
      item.previousTile = { ...currentTile };
      item.currentTile = { ...nextTile };
      item.segment = item.path.length - 2;
      item.progress = 0;
      return "continue";
    }

    const nextMachine = getMachineAtTile(nextTile.tileX, nextTile.tileY);
    if (!nextMachine || !isConveyor(nextMachine)) continue;
    const inputDirection = oppositeDir(dirIndex);
    if (!canItemEnterMachineFromDirection(nextMachine, inputDirection, item.type)) continue;
    if (nextMachine.type === "conveyorFilter" && nextMachine.filterResource !== item.type) continue;
    if (!isLaneAvailableForItem(nextTile.tileX, nextTile.tileY, item, occupiedTiles)) continue;
    if (nextMachine.type === "conveyorMerger" && !canMergerAcceptInput(nextMachine, inputDirection, item, occupiedTiles)) continue;

    candidates.push({
      conveyor: nextMachine,
      tile: nextTile,
      key: tileKey(nextTile.tileX, nextTile.tileY),
      inputDirection,
    });
  }

  const forwardCandidates = candidates.filter((candidate) => candidate.key !== previousKey);
  const usableCandidates = forwardCandidates.length > 0 ? forwardCandidates : candidates;
  if (usableCandidates.length === 0) return "wait";

  const isPriorityConveyor = conveyor.type === "conveyorPriority2" || conveyor.type === "conveyorPriority3";
  const next = isPriorityConveyor
    ? usableCandidates[0]
    : usableCandidates[(conveyor.routeIndex ?? 0) % usableCandidates.length];
  if (!isPriorityConveyor) conveyor.routeIndex = ((conveyor.routeIndex ?? 0) + 1) % usableCandidates.length;
  countGatePass(next.conveyor);
  if (next.conveyor.type === "conveyorMerger") noteMergerAccepted(next.conveyor, next.inputDirection);

  reserveItemTile(item, currentTile, next.tile, occupiedTiles);
  item.previousTile = { ...currentTile };
  item.currentTile = { ...next.tile };
  item.path.push(pointFromMachine(next.conveyor));
  item.segment = item.path.length - 2;
  item.progress = 0;
  return "continue";
}

function isItemRouteStillValid(item) {
  if (!item.currentTile) return false;
  if (isWarehouseInputTile(item.currentTile.tileX, item.currentTile.tileY)) return true;
  if (getStorageInputTargetAtTile(item.currentTile.tileX, item.currentTile.tileY)) return true;
  if (getStorageDepotInputTargetAtTile(item.currentTile.tileX, item.currentTile.tileY)) return true;
  if (isTrashCanTile(item.currentTile.tileX, item.currentTile.tileY)) return true;

  const targetMachine = getMachineAtTile(item.currentTile.tileX, item.currentTile.tileY);
  return Boolean(targetMachine && isConveyor(targetMachine));
}

function placeItemAtWaitPoint(item) {
  const waitPoint = item.path[item.path.length - 1];
  item.x = waitPoint.x;
  item.y = waitPoint.y;
  item.progress = 0;
  item.segment = Math.max(0, item.path.length - 1);
  item.waiting = true;
}

function buildItemTileOccupancy() {
  const occupied = new Map();
  state.items.forEach((item) => {
    const key = getItemTileKey(item);
    if (!key) return;
    const bucket = occupied.get(key) ?? [];
    bucket.push(item);
    occupied.set(key, bucket);
  });
  return occupied;
}

function getItemTileKey(item) {
  if (!item.currentTile) return "";
  return tileKey(item.currentTile.tileX, item.currentTile.tileY);
}

function releaseItemTile(item, occupiedTiles) {
  const key = getItemTileKey(item);
  if (!key) return;
  const bucket = occupiedTiles.get(key);
  if (!bucket) return;
  const nextBucket = bucket.filter((occupant) => occupant !== item);
  if (nextBucket.length > 0) {
    occupiedTiles.set(key, nextBucket);
  } else {
    occupiedTiles.delete(key);
  }
}

function reserveItemTile(item, oldTile, nextTile, occupiedTiles) {
  const oldKey = oldTile ? tileKey(oldTile.tileX, oldTile.tileY) : getItemTileKey(item);
  if (oldKey) {
    const oldBucket = occupiedTiles.get(oldKey);
    if (oldBucket) {
      const nextOldBucket = oldBucket.filter((occupant) => occupant !== item);
      if (nextOldBucket.length > 0) {
        occupiedTiles.set(oldKey, nextOldBucket);
      } else {
        occupiedTiles.delete(oldKey);
      }
    }
  }
  const nextKey = tileKey(nextTile.tileX, nextTile.tileY);
  const nextBucket = occupiedTiles.get(nextKey) ?? [];
  item.lane = getPreferredLane(nextTile.tileX, nextTile.tileY, item, occupiedTiles);
  nextBucket.push(item);
  occupiedTiles.set(nextKey, nextBucket);
}

function isTileAvailableForItem(tileX, tileY, item, occupiedTiles) {
  return getFirstFreeLane(tileX, tileY, item, occupiedTiles) !== -1;
}

function isLaneAvailableForItem(tileX, tileY, item, occupiedTiles) {
  return getPreferredLane(tileX, tileY, item, occupiedTiles) !== -1;
}

function getPreferredLane(tileX, tileY, item, occupiedTiles) {
  const capacity = getTileLaneCapacity(tileX, tileY);
  const lane = Math.max(0, Math.floor(Number(item?.lane) || 0));
  if (capacity === 1) {
    return isLaneUsed(tileX, tileY, 0, item, occupiedTiles) ? -1 : 0;
  }
  const currentCapacity = item?.currentTile
    ? getTileLaneCapacity(item.currentTile.tileX, item.currentTile.tileY)
    : 1;
  if (currentCapacity < capacity) {
    return getFirstFreeLane(tileX, tileY, item, occupiedTiles);
  }
  if (lane >= capacity) return -1;
  return isLaneUsed(tileX, tileY, lane, item, occupiedTiles) ? -1 : lane;
}

function isLaneUsed(tileX, tileY, lane, item, occupiedTiles) {
  return (occupiedTiles.get(tileKey(tileX, tileY)) ?? [])
    .filter((occupant) => occupant !== item)
    .some((occupant) => Math.max(0, Math.floor(Number(occupant.lane) || 0)) === lane);
}

function getFirstFreeLane(tileX, tileY, item, occupiedTiles) {
  const capacity = getTileLaneCapacity(tileX, tileY);
  const usedLanes = new Set((occupiedTiles.get(tileKey(tileX, tileY)) ?? [])
    .filter((occupant) => occupant !== item)
    .map((occupant) => Math.max(0, Math.floor(Number(occupant.lane) || 0))));
  for (let lane = 0; lane < capacity; lane += 1) {
    if (!usedLanes.has(lane)) return lane;
  }
  return -1;
}

function getTileLaneCapacity(tileX, tileY) {
  const machine = getMachineAtTile(tileX, tileY);
  if (machine && isConveyor(machine)) return getConveyorLaneCapacity(machine);
  if (isWarehouseInputTile(tileX, tileY) || getStorageInputTargetAtTile(tileX, tileY) || getStorageDepotInputTargetAtTile(tileX, tileY) || isTrashCanTile(tileX, tileY)) {
    return getIncomingConveyorLaneCapacity(tileX, tileY);
  }
  return 1;
}

function getConveyorLaneCapacity(conveyor) {
  if (!canUpgradeConveyorLanes(conveyor)) return 1;
  return Math.max(1, Math.min(CONFIG.machines.conveyorLaneUpgrade.maxLevel, Math.floor(Number(conveyor.laneLevel) || 1)));
}

function getIncomingConveyorLaneCapacity(tileX, tileY) {
  return DIRS.reduce((capacity, dir, directionFromTarget) => {
    const conveyor = getMachineAtTile(tileX + dir.dx, tileY + dir.dy);
    if (!conveyor || !isConveyor(conveyor)) return capacity;
    if (!getConveyorOutputs(conveyor).includes(oppositeDir(directionFromTarget))) return capacity;
    return Math.max(capacity, getConveyorLaneCapacity(conveyor));
  }, 1);
}

function canMergerAcceptInput(merger, inputDirection, item, occupiedTiles) {
  if (getConveyorLaneCapacity(merger) > 1) return true;

  const waitingInputs = getMergerWaitingInputs(merger, occupiedTiles);
  if (waitingInputs.length === 0) return true;

  const inputKey = tileKey(item.currentTile.tileX, item.currentTile.tileY);
  if (!waitingInputs.some((candidate) => candidate.inputDirection === inputDirection && candidate.key === inputKey)) return true;

  const inputOrder = getConveyorInputs(merger);
  const startIndex = merger.inputRouteIndex ?? 0;
  for (let offset = 0; offset < inputOrder.length; offset += 1) {
    const direction = inputOrder[(startIndex + offset) % inputOrder.length];
    const candidate = waitingInputs.find((entry) => entry.inputDirection === direction);
    if (candidate) return candidate.inputDirection === inputDirection && candidate.key === inputKey;
  }

  return true;
}

function noteMergerAccepted(merger, inputDirection) {
  const inputOrder = getConveyorInputs(merger);
  const index = inputOrder.indexOf(inputDirection);
  if (index === -1) return;
  merger.inputRouteIndex = (index + 1) % inputOrder.length;
}

function getMergerWaitingInputs(merger, occupiedTiles) {
  return getConveyorInputs(merger).flatMap((inputDirection) => {
    const dir = DIRS[inputDirection];
    const tileX = merger.tileX + dir.dx;
    const tileY = merger.tileY + dir.dy;
    const bucket = occupiedTiles.get(tileKey(tileX, tileY)) ?? [];

    const source = getMachineAtTile(tileX, tileY);
    if (!source || !isConveyor(source)) return [];
    if (!getConveyorOutputs(source).includes(oppositeDir(inputDirection))) return [];
    return bucket
      .filter((item) => item.currentTile && item.segment >= item.path.length - 1)
      .map((item) => ({ inputDirection, key: tileKey(tileX, tileY), lane: Math.max(0, Math.floor(Number(item.lane) || 0)) }));
  });
}

function removeDuplicateWaitingItems() {
  const occupiedLanes = new Set();
  state.items = state.items.filter((item) => {
    if (!item.currentTile) return true;
    const capacity = getTileLaneCapacity(item.currentTile.tileX, item.currentTile.tileY);
    const lane = Math.max(0, Math.min(capacity - 1, Math.floor(Number(item.lane) || 0)));
    item.lane = lane;
    const key = `${tileKey(item.currentTile.tileX, item.currentTile.tileY)}:${lane}`;
    if (occupiedLanes.has(key)) return false;
    occupiedLanes.add(key);
    return true;
  });
}

function removeItemsTouchingMachine(machine) {
  const footprint = getFootprint(machine.type);
  const removedTiles = new Set(getFootprintTiles(machine.tileX, machine.tileY, footprint).map((tile) => tileKey(tile.tileX, tile.tileY)));
  state.items = state.items.filter((item) => {
    const currentKey = item.currentTile ? tileKey(item.currentTile.tileX, item.currentTile.tileY) : "";
    return !removedTiles.has(currentKey);
  });
}

function removeItemsAffectedByMove(oldMachine, newMachine) {
  const oldTiles = getFootprintTiles(oldMachine.tileX, oldMachine.tileY, getFootprint(oldMachine.type)).map((tile) => tileKey(tile.tileX, tile.tileY));
  const newTiles = getFootprintTiles(newMachine.tileX, newMachine.tileY, getFootprint(newMachine.type)).map((tile) => tileKey(tile.tileX, tile.tileY));
  const blockedTiles = new Set([...oldTiles, ...newTiles]);

  state.items = state.items.filter((item) => {
    const currentKey = item.currentTile ? tileKey(item.currentTile.tileX, item.currentTile.tileY) : "";
    return !blockedTiles.has(currentKey);
  });
}

function deliverResourceItem(item) {
  state.resources[item.type] = Math.min(CONFIG.storage.resourceMax, (state.resources[item.type] ?? 0) + 1);
  addFloatingResourceText(item.type, item.x, item.y - 26);
}

function canStoreResource(resource) {
  return (state.resources[resource] ?? 0) < CONFIG.storage.resourceMax;
}

function canSpawnItemAt(conveyor, resource = null) {
  if (resource && !canItemEnterMachineFromDirection(conveyor, getConveyorInputs(conveyor)[0], resource)) return false;
  return !isTileAtLaneCapacity(conveyor.tileX, conveyor.tileY);
}

function countGatePass(conveyor) {
  if (conveyor.type !== "conveyorConditional" && conveyor.type !== "conveyorOverflow") return;
  conveyor.passedCount = (conveyor.passedCount ?? 0) + 1;
}

function isTileAtLaneCapacity(tileX, tileY, ignoredItem = null) {
  const capacity = getTileLaneCapacity(tileX, tileY);
  const count = state.items.filter((other) => (
    other !== ignoredItem
    && other.currentTile?.tileX === tileX
    && other.currentTile?.tileY === tileY
  )).length;
  return count >= capacity;
}

function drawItems(ctx) {
  state.items.forEach((item) => {
    const capacity = item.currentTile ? getTileLaneCapacity(item.currentTile.tileX, item.currentTile.tileY) : 1;
    const lane = Math.max(0, Math.min(capacity - 1, Math.floor(Number(item.lane) || 0)));
    const laneOffset = getLaneOffset(lane, capacity);
    const travel = getItemRenderTravel(item);
    const dx = travel.dx;
    const dy = travel.dy;
    const length = Math.max(1, Math.hypot(dx, dy));
    const offsetX = (-dy / length) * laneOffset;
    const offsetY = (dx / length) * laneOffset;
    const itemScale = capacity === 3 ? 0.66 : capacity === 2 ? 0.78 : 1;

    ctx.save();
    ctx.translate(item.x + offsetX, item.y + offsetY);
    ctx.scale(itemScale, itemScale);
    ctx.fillStyle = "rgba(39, 48, 35, 0.16)";
    ctx.beginPath();
    ctx.ellipse(0, 9, 13, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = item.type === "stone" ? "#aeb2aa" : item.type === "iron" ? "#8b9da2" : "#c87838";
    roundedRect(ctx, -11, -9, 22, 16, 4);
    ctx.fill();
    ctx.strokeStyle = item.type === "stone" ? "#6f766e" : item.type === "iron" ? "#516368" : "#744424";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.strokeStyle = item.type === "stone" ? "#e7e5d9" : item.type === "iron" ? "#dce6e8" : "#f0b05a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-7, -3);
    ctx.lineTo(7, -3);
    ctx.moveTo(-6, 3);
    ctx.lineTo(6, 3);
    ctx.stroke();
    ctx.restore();
  });
}

function getItemRenderTravel(item) {
  const from = item.path[item.segment];
  const to = item.path[item.segment + 1];
  if (from && to) return { dx: to.x - from.x, dy: to.y - from.y };

  if (item.currentTile) {
    const conveyor = getMachineAtTile(item.currentTile.tileX, item.currentTile.tileY);
    const outputDirection = conveyor && isConveyor(conveyor) ? getConveyorOutputs(conveyor)[0] : null;
    if (outputDirection !== null && outputDirection !== undefined) {
      const dir = DIRS[outputDirection];
      return { dx: dir.dx, dy: dir.dy };
    }
  }

  return { dx: 1, dy: 0 };
}

function getLaneOffset(lane, capacity) {
  if (capacity <= 1) return 0;
  if (capacity === 2) return lane === 0 ? -13 : 13;
  return [-15, 0, 15][lane] ?? 0;
}

function addFloatingResourceText(resource, x, y) {
  state.effects.push({
    type: "resourceText",
    resource,
    text: `+1 ${getResourceLabel(resource)}`,
    x,
    y,
    time: 0,
    duration: 0.85,
  });
}

function getResourceLabel(resource) {
  return {
    wood: "Holz",
    stone: "Stein",
    iron: "Eisen",
  }[resource] ?? resource;
}

function drawWoodCollector(ctx, machine, time) {
  ctx.save();
  ctx.translate(machine.x, machine.y);

  const size = CONFIG.world.tileSize;
  ctx.fillStyle = "rgba(39, 48, 35, 0.15)";
  ctx.beginPath();
  ctx.ellipse(0, 46, 62, 19, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#567177";
  roundedRect(ctx, -56, -48, 112, 92, 8);
  ctx.fill();
  ctx.strokeStyle = "#2f4448";
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.fillStyle = "#f0a13b";
  roundedRect(ctx, -42, -32, 84, 24, 5);
  ctx.fill();

  ctx.strokeStyle = machine.active ? "#ffd36a" : "#b5beb8";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(-22, 16, 17, 0.1 + time * 0.004, Math.PI * 1.6 + time * 0.004);
  ctx.stroke();

  ctx.fillStyle = machine.active ? "#7bd34c" : machine.connected ? "#ffd36a" : "#929b96";
  ctx.beginPath();
  ctx.arc(42, -34, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#7a4a28";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(-52, 20);
  ctx.lineTo(-size - 4, 2);
  ctx.moveTo(52, 20);
  ctx.lineTo(size + 4, 2);
  ctx.stroke();

  drawFactoryStatusBadge(ctx, machine);
  ctx.restore();
}

function drawStoneCollector(ctx, machine, time) {
  ctx.save();
  ctx.translate(machine.x, machine.y);

  ctx.fillStyle = "rgba(39, 48, 35, 0.15)";
  ctx.beginPath();
  ctx.ellipse(0, 46, 64, 20, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#6d7d82";
  roundedRect(ctx, -56, -48, 112, 92, 8);
  ctx.fill();
  ctx.strokeStyle = "#34464b";
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.fillStyle = "#c8c8bb";
  roundedRect(ctx, -42, -32, 84, 25, 5);
  ctx.fill();

  ctx.fillStyle = "#f0a13b";
  roundedRect(ctx, -18, 8, 60, 25, 5);
  ctx.fill();

  ctx.strokeStyle = machine.active ? "#ffd36a" : "#b5beb8";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-38, 24);
  ctx.lineTo(-16, 2);
  ctx.lineTo(4, 24);
  ctx.stroke();

  ctx.fillStyle = machine.active ? "#7bd34c" : machine.connected ? "#ffd36a" : "#929b96";
  ctx.beginPath();
  ctx.arc(42, -34, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#9fa59f";
  ctx.beginPath();
  ctx.ellipse(-36, 28, 15, 10, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#d7d6c8";
  ctx.beginPath();
  ctx.ellipse(-41, 24, 5, 3, -0.2, 0, Math.PI * 2);
  ctx.fill();

  drawFactoryStatusBadge(ctx, machine);
  ctx.restore();
}

function drawIronCollector(ctx, machine, time) {
  ctx.save();
  ctx.translate(machine.x, machine.y);

  ctx.fillStyle = "rgba(39, 48, 35, 0.15)";
  ctx.beginPath();
  ctx.ellipse(0, 46, 64, 20, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#596b73";
  roundedRect(ctx, -56, -48, 112, 92, 8);
  ctx.fill();
  ctx.strokeStyle = "#2f3d42";
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.fillStyle = "#d8dee0";
  roundedRect(ctx, -42, -31, 84, 24, 5);
  ctx.fill();

  ctx.fillStyle = "#f0a13b";
  roundedRect(ctx, -36, 10, 72, 24, 5);
  ctx.fill();

  ctx.strokeStyle = machine.active ? "#ffd36a" : "#aeb8ba";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-32, 22);
  ctx.lineTo(-12, -2);
  ctx.lineTo(12, 22);
  ctx.lineTo(32, -2);
  ctx.stroke();

  ctx.fillStyle = "#39494e";
  roundedRect(ctx, -18, -3, 36, 18, 4);
  ctx.fill();
  ctx.strokeStyle = "#b8c7ca";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-10, 6);
  ctx.lineTo(10, 6);
  ctx.stroke();

  ctx.fillStyle = machine.active ? "#7bd34c" : machine.connected ? "#ffd36a" : "#929b96";
  ctx.beginPath();
  ctx.arc(42, -34, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#8b9da2";
  ctx.beginPath();
  ctx.ellipse(-38, 30, 13, 9, -0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e5ecee";
  ctx.beginPath();
  ctx.ellipse(-43, 26, 5, 3, -0.25, 0, Math.PI * 2);
  ctx.fill();

  drawFactoryStatusBadge(ctx, machine);
  ctx.restore();
}

function drawFactoryStatusBadge(ctx, machine) {
  const productionConfig = getProductionConfig(machine);
  if (!productionConfig) return;

  const progress = productionConfig.productionSeconds
    ? Math.min(1, (machine.productionTimer ?? 0) / productionConfig.productionSeconds)
    : 0;
  const statusText = {
    working: "LAEUFT",
    blocked: "STAU",
    "no-source": "QUELLE",
    "no-output": "BAND",
  }[machine.status] ?? "WARTET";
  const color = {
    working: "#4f9f43",
    blocked: "#d85f45",
    "no-source": "#d9893d",
    "no-output": "#d9893d",
  }[machine.status] ?? "#929b96";

  ctx.save();
  ctx.translate(0, -70);
  ctx.fillStyle = "rgba(255, 247, 223, 0.92)";
  roundedRect(ctx, -44, -13, 88, 26, 7);
  ctx.fill();
  ctx.strokeStyle = "#4d6f3b";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = "rgba(45, 53, 38, 0.18)";
  roundedRect(ctx, -35, 4, 70, 6, 3);
  ctx.fill();
  ctx.fillStyle = color;
  roundedRect(ctx, -35, 4, 70 * (machine.status === "working" ? progress : 1), 6, 3);
  ctx.fill();

  ctx.fillStyle = color;
  ctx.font = "900 11px Trebuchet MS, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(statusText, 0, -4);
  ctx.restore();
}

function drawStorageUnit(ctx, machine) {
  const size = CONFIG.world.tileSize;
  const width = size * 3;
  const height = size * 2;
  const stored = getStorageFill(machine);
  const max = CONFIG.storage.unitMax;
  const fill = Math.min(1, stored / max);
  const ports = getStoragePorts(machine);

  ctx.save();
  ctx.translate(machine.x, machine.y);

  ctx.fillStyle = "rgba(39, 48, 35, 0.15)";
  ctx.beginPath();
  ctx.ellipse(0, height / 2 - 6, width * 0.46, 20, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#d7ded0";
  roundedRect(ctx, -width / 2 + 6, -height / 2 + 8, width - 12, height - 14, 8);
  ctx.fill();
  ctx.strokeStyle = "#536568";
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.fillStyle = "#315a62";
  roundedRect(ctx, -width / 2 + 12, -height / 2 + 14, width - 24, 18, 5);
  ctx.fill();
  ctx.fillStyle = "#4fa4c8";
  roundedRect(ctx, -width / 2 + 22, -height / 2 + 19, width - 44, 7, 4);
  ctx.fill();

  ctx.fillStyle = "#59676a";
  roundedRect(ctx, -40, -18, 80, 46, 5);
  ctx.fill();
  ctx.strokeStyle = "#333f42";
  ctx.lineWidth = 3;
  for (let y = -8; y <= 17; y += 10) {
    ctx.beginPath();
    ctx.moveTo(-33, y);
    ctx.lineTo(33, y);
    ctx.stroke();
  }

  ctx.fillStyle = "#ffc04d";
  roundedRect(ctx, -28, 12, 56, 18, 4);
  ctx.fill();

  ctx.fillStyle = "#f3b24d";
  drawStorageCrate(ctx, -width / 2 + 20, height / 2 - 42, 28);
  drawStorageCrate(ctx, width / 2 - 48, height / 2 - 42, 28);

  ctx.fillStyle = "#fff7df";
  roundedRect(ctx, -width / 2 + 16, -height / 2 + 42, width - 32, 12, 4);
  ctx.fill();
  ctx.fillStyle = "#7bd34c";
  roundedRect(ctx, -width / 2 + 18, -height / 2 + 44, (width - 36) * fill, 8, 3);
  ctx.fill();

  ctx.fillStyle = "#2d3526";
  ctx.font = "900 15px Trebuchet MS, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`${stored}/${max}`, 0, -height / 2 + 70);

  ctx.restore();

  drawStoragePort(ctx, ports.input, "#7bd34c", "IN");
  drawStoragePort(ctx, ports.output, "#4fa4c8", "OUT");
}

function drawStorageDepot(ctx, machine) {
  const size = CONFIG.world.tileSize;
  const width = size * 4;
  const height = size * 3;
  const ports = getStorageDepotInputPorts(machine);
  const outputs = getStorageDepotOutputPorts(machine);
  const resource = machine.filterResource ?? "wood";
  const color = getResourceColor(resource);

  ctx.save();
  ctx.translate(machine.x, machine.y);

  ctx.fillStyle = "rgba(39, 48, 35, 0.14)";
  ctx.beginPath();
  ctx.ellipse(0, height / 2 - 4, width * 0.45, 24, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#dce2d7";
  roundedRect(ctx, -width / 2 + 7, -height / 2 + 12, width - 14, height - 18, 8);
  ctx.fill();
  ctx.strokeStyle = "#4d6062";
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.fillStyle = "#2f5962";
  roundedRect(ctx, -width / 2 + 12, -height / 2 + 18, width - 24, 18, 5);
  ctx.fill();
  ctx.fillStyle = "#74b7d1";
  roundedRect(ctx, -width / 2 + 22, -height / 2 + 24, width - 44, 6, 3);
  ctx.fill();

  ctx.fillStyle = "#59676a";
  roundedRect(ctx, -48, -18, 96, 82, 6);
  ctx.fill();
  ctx.strokeStyle = "#354345";
  ctx.lineWidth = 3;
  for (let y = -4; y <= 48; y += 13) {
    ctx.beginPath();
    ctx.moveTo(-39, y);
    ctx.lineTo(39, y);
    ctx.stroke();
  }

  ctx.fillStyle = color;
  roundedRect(ctx, -34, 34, 68, 22, 4);
  ctx.fill();

  ctx.fillStyle = "#fff7df";
  roundedRect(ctx, -50, -58, 100, 22, 5);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.font = "900 12px Trebuchet MS, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(getResourceLabel(resource).toUpperCase(), 0, -47);

  ctx.restore();

  ports.forEach((port) => drawStoragePort(ctx, port, color, "IN"));
  outputs.forEach((port) => drawStoragePort(ctx, port, "#4fa4c8", "OUT"));
}

function getResourceColor(resource) {
  return {
    wood: "#c87838",
    stone: "#aeb2aa",
    iron: "#8b9da2",
    coin: "#f2b84b",
  }[resource] ?? "#7bd34c";
}

function drawStoragePort(ctx, port, color, label) {
  const size = CONFIG.world.tileSize;
  const point = tileToWorld(port.tileX, port.tileY);
  const isOutput = label === "OUT";
  const vector = DIRS[port.direction ?? 1] ?? DIRS[1];
  const inset = isOutput ? -26 : 26;
  ctx.save();
  ctx.translate(point.x + vector.dx * inset, point.y + vector.dy * inset);
  ctx.rotate((Math.PI / 2) * ((port.direction ?? 1) - 1));

  ctx.fillStyle = "rgba(39, 48, 35, 0.14)";
  ctx.beginPath();
  ctx.ellipse(0, 18, 28, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  const dockGradient = ctx.createLinearGradient(-30, 0, 30, 0);
  dockGradient.addColorStop(0, "#24373b");
  dockGradient.addColorStop(0.45, "#43575b");
  dockGradient.addColorStop(1, "#24373b");
  ctx.fillStyle = dockGradient;
  roundedRect(ctx, -30, -18, 60, 36, 8);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = "#263437";
  roundedRect(ctx, -21, -10, 42, 20, 6);
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 247, 223, 0.18)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-18, -5);
  ctx.lineTo(18, -5);
  ctx.moveTo(-18, 5);
  ctx.lineTo(18, 5);
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 247, 223, 0.2)";
  roundedRect(ctx, -30, -12, 9, 24, 4);
  ctx.fill();

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-18, -7);
  ctx.lineTo(5, -7);
  ctx.lineTo(5, -15);
  ctx.lineTo(22, 0);
  ctx.lineTo(5, 15);
  ctx.lineTo(5, 7);
  ctx.lineTo(-18, 7);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(255, 247, 223, 0.18)";
  roundedRect(ctx, isOutput ? -size / 2 + 8 : size / 2 - 18, -9, 10, 18, 4);
  ctx.fill();
  ctx.restore();
}

function drawPlacementLabel(ctx, x, y, text, ok) {
  ctx.save();
  ctx.font = "900 18px Trebuchet MS, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const width = Math.min(280, Math.max(116, ctx.measureText(text).width + 28));
  ctx.fillStyle = ok ? "rgba(63, 152, 62, 0.92)" : "rgba(184, 75, 61, 0.94)";
  roundedRect(ctx, x - width / 2, y - 17, width, 34, 8);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 247, 223, 0.78)";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = "#fff7df";
  ctx.fillText(text, x, y + 1);
  ctx.restore();
}

function drawTrashCan(ctx, machine) {
  const size = CONFIG.world.tileSize;
  ctx.save();
  ctx.translate(machine.x, machine.y);

  ctx.fillStyle = "rgba(39, 48, 35, 0.15)";
  ctx.beginPath();
  ctx.ellipse(0, 18, 27, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#4a5658";
  roundedRect(ctx, -22, -22, 44, 46, 7);
  ctx.fill();
  ctx.strokeStyle = "#2f383b";
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.fillStyle = "#6f7b7d";
  roundedRect(ctx, -26, -30, 52, 12, 5);
  ctx.fill();
  ctx.strokeStyle = "#f0a13b";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.strokeStyle = "#ffd36a";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-10, -7);
  ctx.lineTo(10, 13);
  ctx.moveTo(10, -7);
  ctx.lineTo(-10, 13);
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 211, 106, 0.16)";
  ctx.fillRect(-size / 2 + 4, -size / 2 + 4, size - 8, size - 8);
  ctx.restore();
}

function drawStorageCrate(ctx, x, y, size) {
  ctx.fillRect(x, y, size, size);
  ctx.strokeStyle = "#7a4a28";
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, size, size);
  ctx.beginPath();
  ctx.moveTo(x + 5, y + 5);
  ctx.lineTo(x + size - 5, y + size - 5);
  ctx.moveTo(x + size - 5, y + 5);
  ctx.lineTo(x + 5, y + size - 5);
  ctx.stroke();
}

function getFootprint(type) {
  const machineConfig = CONFIG.machines[type] ?? {};
  return {
    width: machineConfig.widthTiles ?? 1,
    height: machineConfig.heightTiles ?? 1,
  };
}

function footprintCenter(tileX, tileY, footprint) {
  return {
    x: tileX * CONFIG.world.tileSize + (CONFIG.world.tileSize * footprint.width) / 2,
    y: tileY * CONFIG.world.tileSize + (CONFIG.world.tileSize * footprint.height) / 2,
  };
}

function getFootprintTiles(tileX, tileY, footprint) {
  const tiles = [];
  for (let y = 0; y < footprint.height; y += 1) {
    for (let x = 0; x < footprint.width; x += 1) {
      tiles.push({ tileX: tileX + x, tileY: tileY + y });
    }
  }
  return tiles;
}

function drawConveyor(ctx, conveyor, time) {
  ctx.save();
  ctx.translate(conveyor.x, conveyor.y);
  ctx.rotate((Math.PI / 2) * conveyor.rotation);
  if (conveyor.type === "conveyorCorner" && conveyor.mirrored) ctx.scale(1, -1);

  const size = CONFIG.world.tileSize;
  ctx.fillStyle = "rgba(39, 48, 35, 0.14)";
  roundedRect(ctx, -size / 2 + 5, -size / 2 + 10, size - 10, size - 17, 9);
  ctx.fill();
  drawConveyorConnectors(ctx, conveyor);

  const beltGradient = ctx.createLinearGradient(0, -17, 0, 17);
  beltGradient.addColorStop(0, "#677477");
  beltGradient.addColorStop(0.5, "#465154");
  beltGradient.addColorStop(1, "#303b3e");
  ctx.fillStyle = beltGradient;
  roundedRect(ctx, -size / 2 + 5, -15, size - 10, 30, 7);
  ctx.fill();
  ctx.strokeStyle = "#2f383b";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.strokeStyle = "rgba(255, 247, 223, 0.22)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-size / 2 + 13, -9);
  ctx.lineTo(size / 2 - 13, -9);
  ctx.moveTo(-size / 2 + 13, 9);
  ctx.lineTo(size / 2 - 13, 9);
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 211, 106, 0.16)";
  for (let x = -size / 2 + 15; x <= size / 2 - 15; x += 22) {
    roundedRect(ctx, x - 3, -12, 6, 24, 3);
    ctx.fill();
  }

  ctx.strokeStyle = "#f0a13b";
  ctx.lineWidth = 4;
  ctx.setLineDash([12, 12]);
  ctx.lineDashOffset = -(time * 0.035) % 24;
  ctx.beginPath();
  if (conveyor.type === "conveyorStraight" || conveyor.type === "conveyorConditional" || conveyor.type === "conveyorOverflow" || conveyor.type === "conveyorFilter") {
    ctx.moveTo(-size / 2 + 10, 0);
    ctx.lineTo(size / 2 - 10, 0);
    ctx.stroke();
    drawArrowHead(ctx, size / 2 - 9, 0, 0);
  } else if (conveyor.type === "conveyorCorner") {
    ctx.moveTo(0, -size / 2 + 10);
    ctx.quadraticCurveTo(0, 0, size / 2 - 10, 0);
    ctx.stroke();
    drawArrowHead(ctx, size / 2 - 9, 0, 0);
  } else if (conveyor.type === "conveyorPriority2") {
    ctx.moveTo(-size / 2 + 10, 0);
    ctx.lineTo(0, 0);
    ctx.lineTo(0, conveyor.mirrored ? -size / 2 + 10 : size / 2 - 10);
    ctx.moveTo(0, 0);
    ctx.lineTo(size / 2 - 10, 0);
    ctx.stroke();
    drawArrowHead(ctx, 0, conveyor.mirrored ? -size / 2 + 10 : size / 2 - 10, conveyor.mirrored ? -Math.PI / 2 : Math.PI / 2);
    drawArrowHead(ctx, size / 2 - 9, 0, 0);
  } else if (conveyor.type === "conveyorPriority3") {
    ctx.moveTo(-size / 2 + 10, 0);
    ctx.lineTo(0, 0);
    ctx.lineTo(0, -size / 2 + 10);
    ctx.moveTo(0, 0);
    ctx.lineTo(size / 2 - 10, 0);
    ctx.moveTo(0, 0);
    ctx.lineTo(0, size / 2 - 10);
    ctx.stroke();
    drawArrowHead(ctx, 0, -size / 2 + 10, -Math.PI / 2);
    drawArrowHead(ctx, size / 2 - 9, 0, 0);
    drawArrowHead(ctx, 0, size / 2 - 10, Math.PI / 2);
  } else {
    ctx.moveTo(-size / 2 + 10, 0);
    ctx.lineTo(size / 2 - 9, 0);
    ctx.moveTo(0, -size / 2 + 10);
    ctx.lineTo(0, size / 2 - 10);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  if (conveyor.type === "conveyorMerger" || conveyor.type === "conveyorSplitter" || conveyor.type === "conveyorPriority2" || conveyor.type === "conveyorPriority3") {
    drawConveyorJunctionMark(ctx, conveyor.type);
  }
  if (conveyor.type === "conveyorConditional" || conveyor.type === "conveyorOverflow") {
    drawConditionalConveyorMark(ctx, conveyor);
  }
  if (conveyor.type === "conveyorFilter") {
    drawFilterConveyorMark(ctx, conveyor);
  }
  drawLaneLevelMark(ctx, conveyor);

  ctx.restore();
}

function drawConveyorConnectors(ctx, conveyor) {
  const size = CONFIG.world.tileSize;
  const rotation = conveyor.rotation % 4;
  getConveyorConnections(conveyor).forEach((direction) => {
    if (!hasVisualConveyorConnection(conveyor, direction)) return;
    const localDirection = (direction - rotation + 4) % 4;
    const isVertical = localDirection === 0 || localDirection === 2;
    const x = localDirection === 1 ? 0 : localDirection === 3 ? -size / 2 : -15;
    const y = localDirection === 2 ? 0 : localDirection === 0 ? -size / 2 : -15;
    const width = isVertical ? 30 : size / 2;
    const height = isVertical ? size / 2 : 30;

    const connectorGradient = isVertical
      ? ctx.createLinearGradient(0, y, 0, y + height)
      : ctx.createLinearGradient(x, 0, x + width, 0);
    connectorGradient.addColorStop(0, "#303b3e");
    connectorGradient.addColorStop(0.5, "#515d60");
    connectorGradient.addColorStop(1, "#303b3e");
    ctx.fillStyle = connectorGradient;
    roundedRect(ctx, x, y, width, height, 5);
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 247, 223, 0.18)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    if (isVertical) {
      ctx.moveTo(x + 8, y + 7);
      ctx.lineTo(x + 8, y + height - 7);
      ctx.moveTo(x + width - 8, y + 7);
      ctx.lineTo(x + width - 8, y + height - 7);
    } else {
      ctx.moveTo(x + 7, y + 8);
      ctx.lineTo(x + width - 7, y + 8);
      ctx.moveTo(x + 7, y + height - 8);
      ctx.lineTo(x + width - 7, y + height - 8);
    }
    ctx.stroke();
  });
}

function hasVisualConveyorConnection(conveyor, direction) {
  const dir = DIRS[direction];
  const tileX = conveyor.tileX + dir.dx;
  const tileY = conveyor.tileY + dir.dy;
  const nextMachine = getMachineAtTile(tileX, tileY);
  if (nextMachine && isConveyor(nextMachine)) {
    return getConveyorConnections(nextMachine).includes(oppositeDir(direction));
  }
  return Boolean(
    getWarehouseInputTargetAtTile(tileX, tileY)
    || isWarehouseOutputTile(tileX, tileY)
    || getStorageInputTargetAtTile(tileX, tileY)
    || getStorageOutputTargetAtTile(tileX, tileY)
    || getStorageDepotInputTargetAtTile(tileX, tileY)
    || isStorageDepotOutputTile(tileX, tileY)
    || isTrashCanTile(tileX, tileY)
  );
}

function drawLaneLevelMark(ctx, conveyor) {
  if (!canUpgradeConveyorLanes(conveyor)) return;
  const lanes = getConveyorLaneCapacity(conveyor);
  if (lanes <= 1) return;

  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(255, 247, 223, 0.92)";
  ctx.strokeStyle = "#26383a";
  ctx.lineWidth = 2;
  roundedRect(ctx, -18, 16, 36, 12, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#f0a13b";
  for (let lane = 0; lane < lanes; lane += 1) {
    ctx.beginPath();
    ctx.arc(getLaneOffset(lane, lanes) * 0.65, 22, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawFilterConveyorMark(ctx, conveyor) {
  const resource = conveyor.filterResource ?? "wood";
  ctx.setLineDash([]);
  ctx.fillStyle = resource === "stone" ? "#aeb2aa" : resource === "iron" ? "#8b9da2" : "#c87838";
  roundedRect(ctx, -15, -24, 30, 18, 5);
  ctx.fill();
  ctx.strokeStyle = resource === "stone" ? "#6f766e" : resource === "iron" ? "#516368" : "#744424";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = "#fff7df";
  ctx.font = "900 13px Trebuchet MS, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText({ wood: "H", stone: "S", iron: "E" }[resource] ?? "?", 0, -15);
}

function drawConditionalConveyorMark(ctx, conveyor) {
  const canPassAnything = Object.keys(CONFIG.resources)
    .filter((resource) => resource !== "coin")
    .some((resource) => canConditionalConveyorPass(conveyor, resource));
  ctx.setLineDash([]);
  ctx.fillStyle = canPassAnything ? "#7bd34c" : "#d85f45";
  roundedRect(ctx, -16, -23, 32, 14, 4);
  ctx.fill();
  ctx.strokeStyle = "#2f383b";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.strokeStyle = "#fff7df";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-14, 15);
  ctx.lineTo(14, -15);
  ctx.stroke();

  if (conveyor.type === "conveyorOverflow") {
    ctx.fillStyle = "#fff7df";
    ctx.font = "900 12px Trebuchet MS, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("VOLL", 0, 20);
  }
}

function drawConveyorJunctionMark(ctx, type) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#ffd36a";
  ctx.fillStyle = "#ffd36a";
  ctx.lineWidth = 4;

  if (type === "conveyorMerger") {
    ctx.beginPath();
    ctx.moveTo(-19, -15);
    ctx.lineTo(0, 0);
    ctx.lineTo(22, 0);
    ctx.moveTo(-19, 15);
    ctx.lineTo(0, 0);
    ctx.moveTo(-22, 0);
    ctx.lineTo(0, 0);
    ctx.stroke();
    drawArrowHead(ctx, 22, 0, 0);
    return;
  }

  if (type === "conveyorPriority2" || type === "conveyorPriority3") {
    ctx.fillStyle = "#fff7df";
    ctx.strokeStyle = "#26383a";
    roundedRect(ctx, -16, -16, 32, 32, 7);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#f0a13b";
    ctx.font = "900 16px Trebuchet MS, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(type === "conveyorPriority2" ? "2" : "3", 0, 1);
    return;
  }

  ctx.beginPath();
  ctx.moveTo(-22, 0);
  ctx.lineTo(0, 0);
  ctx.lineTo(22, 0);
  ctx.moveTo(0, 0);
  ctx.lineTo(19, -15);
  ctx.moveTo(0, 0);
  ctx.lineTo(19, 15);
  ctx.stroke();
  drawArrowHead(ctx, 22, 0, 0);
  drawArrowHead(ctx, 19, -15, -Math.PI / 4);
  drawArrowHead(ctx, 19, 15, Math.PI / 4);
}

function drawArrowHead(ctx, x, y, angle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-8, -5);
  ctx.lineTo(-8, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

window.Sproutworks.machines = {
  canAfford,
  canUpgradeConveyorLanes,
  canPlaceBuildable,
  demolishBuildableAt,
  getPlacementErrorMessage,
  getMachineAtWorld,
  harvestResourceAt,
  refundAllBuildings,
  drawHarvestAnimation,
  drawMovePreview,
  drawBuildPreview,
  drawDemolishPreview,
  drawMachines,
  getWarehouseInputTile,
  getWarehouseInputTiles,
  getWarehouseOutputTiles,
  handleMoveToolAt,
  mirrorBuildMode,
  rotateBuildMode,
  tryPlaceBuildable,
  upgradeConveyorLanes,
  updateMachines,
  updateHarvestAnimation,
};
})();
