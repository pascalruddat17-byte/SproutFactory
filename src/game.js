(() => {
const { CONFIG } = window.Sproutworks;
const { drawWorld, isPointInWarehouse } = window.Sproutworks.world;
const { demolishBuildableAt, drawBuildPreview, drawDemolishPreview, drawHarvestAnimation, drawMovePreview, getMachineAtWorld, getPlacementErrorMessage, handleMoveToolAt, harvestResourceAt, tryPlaceBuildable, updateHarvestAnimation, updateMachines } = window.Sproutworks.machines;
const { createInput, setupUi, showMachineInfoPanel, showToast, showWarehousePanel, setBuildHintVisible, updateFactoryStatus, updateResourceCounters } = window.Sproutworks.ui;
const { state } = window.Sproutworks;
const { saveGame } = window.Sproutworks.save;

const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");
const resourceBar = document.querySelector("#resourceBar");
const factoryStatus = document.querySelector("#factoryStatus");
const input = createInput();
const camera = {
  x: CONFIG.camera.startX,
  y: CONFIG.camera.startY,
  zoom: 1,
};
const MINIMAP = {
  width: 184,
  height: 134,
  margin: 16,
};

let lastTime = performance.now();
let lastSaveTime = performance.now();
let width = 0;
let height = 0;
let hasPositionedCamera = false;

setupUi(input);
resizeCanvas();
window.addEventListener("resize", resizeCanvas);
window.addEventListener("beforeunload", () => {
  saveGame();
});
requestAnimationFrame(tick);

function tick(now) {
  const delta = Math.min((now - lastTime) / 1000, 0.033);
  lastTime = now;

  updateCamera(delta);
  updatePointerWorld();
  updateMachines(delta);
  updateHarvestAnimation(delta);
  updateEffects(delta);
  state.harvestCooldown = Math.max(0, state.harvestCooldown - delta);
  handleClicks();
  autoSave(now);
  updateResourceCounters(resourceBar, state.resources);
  updateFactoryStatus(factoryStatus);
  draw(now);

  requestAnimationFrame(tick);
}

function autoSave(now) {
  if (!state.saveDirty || now - lastSaveTime < 1000) return;
  saveGame();
  lastSaveTime = now;
}

function updateCamera(delta) {
  let dx = 0;
  let dy = 0;

  if (input.up) dy -= 1;
  if (input.down) dy += 1;
  if (input.left) dx -= 1;
  if (input.right) dx += 1;

  const length = Math.hypot(dx, dy) || 1;
  const speed = CONFIG.camera.keyboardSpeed * delta;
  camera.x += (dx / length) * speed;
  camera.y += (dy / length) * speed;

  camera.x -= (input.dragX * CONFIG.camera.dragSensitivity) / camera.zoom;
  camera.y -= (input.dragY * CONFIG.camera.dragSensitivity) / camera.zoom;
  input.dragX = 0;
  input.dragY = 0;

  input.zoomEvents.splice(0).forEach((event) => {
    zoomAt(event.factor, event.screenX, event.screenY);
  });

  clampCamera();
}

function draw(time) {
  ctx.clearRect(0, 0, width, height);
  drawWorld(ctx, camera, time);
  drawHarvestAnimation(ctx, camera);
  drawEffects(ctx, camera);
  drawBuildPreview(ctx, camera, input.pointerWorld, time);
  drawDemolishPreview(ctx, camera, input.pointerWorld);
  drawMovePreview(ctx, camera, input.pointerWorld, time);
  drawVignette();
  drawMinimap();
}

function drawVignette() {
  const gradient = ctx.createRadialGradient(width * 0.5, height * 0.42, Math.min(width, height) * 0.25, width * 0.5, height * 0.5, Math.max(width, height) * 0.72);
  gradient.addColorStop(0, "rgba(255, 244, 190, 0.08)");
  gradient.addColorStop(1, "rgba(53, 92, 46, 0.2)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function resizeCanvas() {
  const ratio = Math.max(1, window.devicePixelRatio || 1);
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor(height * ratio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  if (!hasPositionedCamera) {
    camera.x = CONFIG.camera.startX - width / (2 * camera.zoom);
    camera.y = CONFIG.camera.startY - height / (2 * camera.zoom);
    hasPositionedCamera = true;
  }
  clampCamera();
}

function clampCamera() {
  camera.x = clamp(camera.x, 0, Math.max(0, CONFIG.world.width - width / camera.zoom));
  camera.y = clamp(camera.y, 0, Math.max(0, CONFIG.world.height - height / camera.zoom));
}

function zoomAt(factor, screenX, screenY) {
  const oldZoom = camera.zoom;
  const nextZoom = clamp(oldZoom * factor, CONFIG.camera.minZoom, CONFIG.camera.maxZoom);
  const worldX = camera.x + screenX / oldZoom;
  const worldY = camera.y + screenY / oldZoom;

  camera.zoom = nextZoom;
  camera.x = worldX - screenX / nextZoom;
  camera.y = worldY - screenY / nextZoom;
}

function handleClicks() {
  input.clickEvents.splice(0).forEach((event) => {
    if (handleMinimapClick(event.screenX, event.screenY)) return;

    const worldX = camera.x + event.screenX / camera.zoom;
    const worldY = camera.y + event.screenY / camera.zoom;
    if (state.buildMode) {
      if (tryPlaceBuildable(state.buildMode, worldX, worldY)) {
        setBuildHintVisible(Boolean(state.buildMode));
      } else {
        showToast(getPlacementErrorMessage(state.buildMode, worldX, worldY));
      }
      return;
    }

    if (state.demolishMode) {
      demolishBuildableAt(worldX, worldY);
      return;
    }

    if (state.moveMode) {
      handleMoveToolAt(worldX, worldY);
      setBuildHintVisible(true, state.movingMachineId ? "Move: neue Stelle anklicken · R drehen · F spiegeln" : "Move: Teil auswaehlen und neue Stelle anklicken");
      return;
    }

    if (state.harvestMode) {
      harvestResourceAt(worldX, worldY);
      return;
    }

    const machine = getMachineAtWorld(worldX, worldY);
    if (machine) {
      showMachineInfoPanel(machine);
      return;
    }

    if (isPointInWarehouse(worldX, worldY)) {
      showWarehousePanel();
    }
  });
}

function updatePointerWorld() {
  if (!input.pointerScreen) return;
  input.pointerWorld = {
    x: camera.x + input.pointerScreen.x / camera.zoom,
    y: camera.y + input.pointerScreen.y / camera.zoom,
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getMinimapBounds() {
  return {
    x: MINIMAP.margin,
    y: Math.max(92, height - MINIMAP.height - 96),
    width: MINIMAP.width,
    height: MINIMAP.height,
  };
}

function handleMinimapClick(screenX, screenY) {
  const map = getMinimapBounds();
  if (
    screenX < map.x
    || screenX > map.x + map.width
    || screenY < map.y
    || screenY > map.y + map.height
  ) return false;

  const worldX = ((screenX - map.x) / map.width) * CONFIG.world.width;
  const worldY = ((screenY - map.y) / map.height) * CONFIG.world.height;
  camera.x = worldX - width / (2 * camera.zoom);
  camera.y = worldY - height / (2 * camera.zoom);
  clampCamera();
  showToast("Kamera zur Mini-Map-Position bewegt.");
  return true;
}

function updateEffects(delta) {
  state.effects = state.effects.filter((effect) => {
    effect.time += delta;
    return effect.time < effect.duration;
  });
}

function drawEffects(ctx, camera) {
  if (state.effects.length === 0) return;

  ctx.save();
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x, -camera.y);
  state.effects.forEach((effect) => {
    if (effect.type !== "resourceText") return;
    const progress = effect.time / effect.duration;
    const y = effect.y - progress * 34;
    ctx.globalAlpha = 1 - progress;
    ctx.fillStyle = "#fff7df";
    ctx.strokeStyle = effect.resource === "iron" ? "#516368" : effect.resource === "stone" ? "#6f766e" : "#744424";
    ctx.lineWidth = 5;
    ctx.font = "900 22px Trebuchet MS, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeText(effect.text, effect.x, y);
    ctx.fillText(effect.text, effect.x, y);
  });
  ctx.restore();
}

function drawMinimap() {
  const map = getMinimapBounds();
  const x = map.x;
  const y = map.y;
  const scaleX = map.width / CONFIG.world.width;
  const scaleY = map.height / CONFIG.world.height;
  const world = window.Sproutworks.world;

  ctx.save();
  ctx.globalAlpha = 0.95;
  ctx.fillStyle = "rgba(255, 247, 223, 0.9)";
  ctx.fillRect(x - 5, y - 5, map.width + 10, map.height + 10);
  ctx.strokeStyle = "#4d6f3b";
  ctx.lineWidth = 3;
  ctx.strokeRect(x - 5, y - 5, map.width + 10, map.height + 10);

  ctx.fillStyle = "#8dce6d";
  ctx.fillRect(x, y, map.width, map.height);

  ctx.fillStyle = "#2f6f3b";
  world.trees.forEach((tree) => drawMinimapDot(x + tree.x * scaleX, y + tree.y * scaleY, 1.6));
  ctx.fillStyle = "#7f8580";
  world.rocks.forEach((rock) => drawMinimapDot(x + rock.x * scaleX, y + rock.y * scaleY, 1.4));
  ctx.fillStyle = "#b86c44";
  world.ironOres.forEach((ore) => drawMinimapDot(x + ore.x * scaleX, y + ore.y * scaleY, 1.4));
  ctx.fillStyle = "#f0a13b";
  state.machines.forEach((machine) => drawMinimapDot(x + machine.x * scaleX, y + machine.y * scaleY, 2.1));

  const warehouse = world.warehouse;
  ctx.fillStyle = "#315a62";
  ctx.fillRect(x + (warehouse.x - warehouse.width / 2) * scaleX, y + (warehouse.y - 80) * scaleY, warehouse.width * scaleX, warehouse.height * scaleY);

  ctx.strokeStyle = "#fff8dd";
  ctx.lineWidth = 2;
  ctx.strokeRect(x + camera.x * scaleX, y + camera.y * scaleY, (width / camera.zoom) * scaleX, (height / camera.zoom) * scaleY);
  ctx.fillStyle = "#2d3526";
  ctx.font = "900 11px Trebuchet MS, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Mini-Map", x + map.width / 2, y + map.height + 16);
  ctx.restore();
}

function drawMinimapDot(x, y, radius) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}
})();
