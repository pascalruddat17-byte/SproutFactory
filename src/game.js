(() => {
const { CONFIG } = window.Sproutworks;
const { drawWorld, isPointInWarehouse } = window.Sproutworks.world;
const { demolishBuildableAt, drawBuildPreview, drawDemolishPreview, drawHarvestAnimation, drawMovePreview, handleMoveToolAt, harvestResourceAt, tryPlaceBuildable, updateHarvestAnimation, updateMachines } = window.Sproutworks.machines;
const { createInput, setupUi, showWarehousePanel, setBuildHintVisible, updateResourceCounters } = window.Sproutworks.ui;
const { state } = window.Sproutworks;
const { saveGame } = window.Sproutworks.save;

const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");
const resourceBar = document.querySelector("#resourceBar");
const input = createInput();
const camera = {
  x: CONFIG.camera.startX,
  y: CONFIG.camera.startY,
  zoom: 1,
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
  state.harvestCooldown = Math.max(0, state.harvestCooldown - delta);
  handleClicks();
  autoSave(now);
  updateResourceCounters(resourceBar, state.resources);
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
  drawBuildPreview(ctx, camera, input.pointerWorld, time);
  drawDemolishPreview(ctx, camera, input.pointerWorld);
  drawMovePreview(ctx, camera, input.pointerWorld, time);
  drawVignette();
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
    const worldX = camera.x + event.screenX / camera.zoom;
    const worldY = camera.y + event.screenY / camera.zoom;
    if (state.buildMode) {
      if (tryPlaceBuildable(state.buildMode, worldX, worldY)) {
        setBuildHintVisible(Boolean(state.buildMode));
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
})();
