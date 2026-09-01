(() => {
window.Sproutworks = window.Sproutworks || {};

const { CONFIG } = window.Sproutworks;

let trees = [
  { x: 280, y: 260, r: 58, kind: "round" },
  { x: 520, y: 420, r: 52, kind: "pine" },
  { x: 910, y: 250, r: 62, kind: "round" },
  { x: 1350, y: 310, r: 52, kind: "pine" },
  { x: 1740, y: 300, r: 65, kind: "round" },
  { x: 1980, y: 620, r: 54, kind: "pine" },
  { x: 360, y: 760, r: 62, kind: "round" },
  { x: 680, y: 1030, r: 52, kind: "pine" },
  { x: 1580, y: 1060, r: 68, kind: "round" },
  { x: 1940, y: 1250, r: 58, kind: "round" },
  { x: 1120, y: 1320, r: 55, kind: "pine" },
  { x: 2520, y: 380, r: 64, kind: "round" },
  { x: 3020, y: 520, r: 55, kind: "pine" },
  { x: 3640, y: 340, r: 70, kind: "round" },
  { x: 4140, y: 780, r: 56, kind: "pine" },
  { x: 2480, y: 1180, r: 54, kind: "pine" },
  { x: 3220, y: 1320, r: 66, kind: "round" },
  { x: 3920, y: 1480, r: 58, kind: "round" },
  { x: 430, y: 1820, r: 62, kind: "round" },
  { x: 920, y: 2100, r: 56, kind: "pine" },
  { x: 1510, y: 1880, r: 65, kind: "round" },
  { x: 2110, y: 2240, r: 54, kind: "pine" },
  { x: 2690, y: 2010, r: 70, kind: "round" },
  { x: 3360, y: 2360, r: 56, kind: "pine" },
  { x: 3970, y: 2140, r: 66, kind: "round" },
  { x: 720, y: 2840, r: 58, kind: "round" },
  { x: 1760, y: 2890, r: 52, kind: "pine" },
  { x: 2910, y: 2920, r: 62, kind: "round" },
  { x: 4080, y: 2810, r: 55, kind: "pine" },
];

let rocks = [
  { x: 760, y: 640, r: 30 },
  { x: 1430, y: 710, r: 34 },
  { x: 1010, y: 1110, r: 27 },
  { x: 2640, y: 860, r: 31 },
  { x: 3520, y: 990, r: 35 },
  { x: 4170, y: 1610, r: 29 },
  { x: 620, y: 2230, r: 33 },
  { x: 1740, y: 2450, r: 28 },
  { x: 2480, y: 2840, r: 36 },
  { x: 3750, y: 2710, r: 30 },
];

let ironOres = [
  { x: 1180, y: 760, r: 34 },
  { x: 2260, y: 420, r: 30 },
  { x: 3090, y: 880, r: 37 },
  { x: 3820, y: 1180, r: 32 },
  { x: 1180, y: 2520, r: 36 },
  { x: 2220, y: 2680, r: 31 },
  { x: 3320, y: 2700, r: 35 },
];

const bushes = [
  { x: 440, y: 570, s: 1.1 },
  { x: 1220, y: 500, s: 0.9 },
  { x: 1820, y: 850, s: 1.15 },
  { x: 820, y: 1250, s: 0.95 },
  { x: 1500, y: 1325, s: 1 },
  { x: 2420, y: 650, s: 1.05 },
  { x: 3320, y: 760, s: 0.92 },
  { x: 3990, y: 1190, s: 1.18 },
  { x: 520, y: 1710, s: 0.98 },
  { x: 1290, y: 2320, s: 1.12 },
  { x: 2290, y: 1780, s: 0.9 },
  { x: 3070, y: 2480, s: 1.08 },
  { x: 3900, y: 3020, s: 1 },
];

const leaves = Array.from({ length: 190 }, (_, i) => {
  const x = (i * 197) % CONFIG.world.width;
  const y = (i * 113 + 80) % CONFIG.world.height;
  return { x, y, a: ((i * 31) % 100) / 100 };
});

const grass = Array.from({ length: 310 }, (_, i) => {
  const x = (i * 151 + 35) % CONFIG.world.width;
  const y = (i * 257 + 90) % CONFIG.world.height;
  return { x, y, h: 10 + (i % 4) * 4 };
});

const warehouse = {
  x: CONFIG.world.width * 0.5,
  y: CONFIG.world.height * 0.5,
  width: 332,
  height: 166,
};

let obstacles = [
  ...trees.map((tree) => ({ x: tree.x, y: tree.y + 18, r: tree.r * 0.58 })),
  ...rocks.map((rock) => ({ x: rock.x, y: rock.y, r: rock.r })),
  ...ironOres.map((ore) => ({ x: ore.x, y: ore.y, r: ore.r })),
];

function makeSeededRandom(seed) {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

function getNodeCounts() {
  const baseArea = 4400 * 3200;
  const areaScale = Math.max(1, Math.round((CONFIG.world.width * CONFIG.world.height) / baseArea));
  return {
    trees: 28 * areaScale,
    rocks: 11 * areaScale,
    ironOres: 7 * areaScale,
  };
}

function rebuildObstacles() {
  obstacles = [
    ...trees.map((tree) => ({ x: tree.x, y: tree.y + 18, r: tree.r * 0.58 })),
    ...rocks.map((rock) => ({ x: rock.x, y: rock.y, r: rock.r })),
    ...ironOres.map((ore) => ({ x: ore.x, y: ore.y, r: ore.r })),
  ];
}

function syncWorldExports() {
  if (!window.Sproutworks.world) return;
  window.Sproutworks.world.trees = trees;
  window.Sproutworks.world.rocks = rocks;
  window.Sproutworks.world.ironOres = ironOres;
  window.Sproutworks.world.obstacles = obstacles;
}

function applyRemovedSources() {
  const removed = new Set(window.Sproutworks.state?.removedSources ?? []);
  if (removed.size === 0) return;
  trees = trees.filter((tree) => !removed.has(tree.id));
  rocks = rocks.filter((rock) => !removed.has(rock.id));
  ironOres = ironOres.filter((ore) => !removed.has(ore.id));
}

function regenerateWorld(random = Math.random) {
  const occupied = [];
  const centerX = CONFIG.world.width * 0.5;
  const centerY = CONFIG.world.height * 0.5;
  const counts = getNodeCounts();

  function createNodes(count, minRadius, factory) {
    const nodes = [];
    let attempts = 0;
    while (nodes.length < count && attempts < count * 100) {
      attempts += 1;
      const node = factory(140 + random() * (CONFIG.world.width - 280), 140 + random() * (CONFIG.world.height - 280));
      if (Math.hypot(node.x - centerX, node.y - centerY) < 430) continue;
      if (occupied.some((other) => Math.hypot(node.x - other.x, node.y - other.y) < minRadius + other.r + 70)) continue;
      nodes.push(node);
      occupied.push(node);
    }
    return nodes;
  }

  trees = createNodes(counts.trees, 64, (x, y) => ({ id: `tree-${Math.round(x)}-${Math.round(y)}`, x, y, r: 50 + random() * 20, kind: random() > 0.55 ? "pine" : "round" }));
  rocks = createNodes(counts.rocks, 36, (x, y) => ({ id: `rock-${Math.round(x)}-${Math.round(y)}`, x, y, r: 27 + random() * 9 }));
  ironOres = createNodes(counts.ironOres, 38, (x, y) => ({ id: `ore-${Math.round(x)}-${Math.round(y)}`, x, y, r: 29 + random() * 8 }));
  applyRemovedSources();
  rebuildObstacles();
  syncWorldExports();
}

regenerateWorld(makeSeededRandom(20260831));

function clampToWorld(entity) {
  entity.x = Math.max(entity.radius, Math.min(CONFIG.world.width - entity.radius, entity.x));
  entity.y = Math.max(entity.radius, Math.min(CONFIG.world.height - entity.radius, entity.y));
}

function collides(x, y, radius) {
  return obstacles.some((obstacle) => {
    const dx = x - obstacle.x;
    const dy = y - obstacle.y;
    const minDistance = radius + obstacle.r;
    return dx * dx + dy * dy < minDistance * minDistance;
  });
}

function isPointInWarehouse(x, y) {
  return (
    x >= warehouse.x - warehouse.width / 2 &&
    x <= warehouse.x + warehouse.width / 2 &&
    y >= warehouse.y - 80 &&
    y <= warehouse.y - 80 + warehouse.height
  );
}

function getResourceSourceAt(x, y) {
  const candidates = [
    ...trees.map((node) => ({ node, radius: node.r * 0.9 })),
    ...rocks.map((node) => ({ node, radius: node.r + 18 })),
    ...ironOres.map((node) => ({ node, radius: node.r + 18 })),
  ];
  return candidates
    .map((candidate) => ({ ...candidate, distance: Math.hypot(x - candidate.node.x, y - candidate.node.y) }))
    .filter((candidate) => candidate.distance <= candidate.radius)
    .sort((a, b) => a.distance - b.distance)[0]?.node ?? null;
}

function removeResourceSourceAt(x, y) {
  const target = getResourceSourceAt(x, y);
  if (!target) return false;

  trees = trees.filter((tree) => tree !== target);
  rocks = rocks.filter((rock) => rock !== target);
  ironOres = ironOres.filter((ore) => ore !== target);

  if (target.id) {
    const removed = window.Sproutworks.state?.removedSources;
    if (removed && !removed.includes(target.id)) removed.push(target.id);
  }
  rebuildObstacles();
  syncWorldExports();
  window.Sproutworks.save?.markSaveDirty();
  return true;
}

function drawResourceClearPreview(ctx, camera, pointerWorld) {
  if (!window.Sproutworks.state?.sourceClearMode || !pointerWorld) return;
  const target = getResourceSourceAt(pointerWorld.x, pointerWorld.y);
  if (!target) return;

  ctx.save();
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x, -camera.y);
  ctx.globalAlpha = 0.42;
  ctx.fillStyle = "#e45a43";
  ctx.beginPath();
  ctx.arc(target.x, target.y, target.r + 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "#7d3329";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(target.x, target.y, target.r + 20, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawWorld(ctx, camera, time) {
  const { width, height } = CONFIG.world;

  ctx.save();
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x, -camera.y);
  drawGround(ctx, width, height);
  drawScenery(ctx, time);
  window.Sproutworks.machines.drawMachines(ctx, time);
  drawWarehouseInput(ctx);
  drawStartingWarehouse(ctx);
  ctx.restore();
}

function drawGround(ctx, width, height) {
  ctx.fillStyle = "#8dce6d";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  ctx.lineWidth = 2;
  for (let x = 0; x < width; x += CONFIG.world.tileSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += CONFIG.world.tileSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  const light = ctx.createRadialGradient(CONFIG.world.width * 0.5, CONFIG.world.height * 0.38, 120, CONFIG.world.width * 0.5, CONFIG.world.height * 0.38, 1300);
  light.addColorStop(0, "rgba(255, 228, 132, 0.24)");
  light.addColorStop(1, "rgba(255, 228, 132, 0)");
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, width, height);
}

function drawScenery(ctx, time) {
  grass.forEach((blade) => drawGrass(ctx, blade.x, blade.y, blade.h));
  leaves.forEach((leaf) => drawLeaf(ctx, leaf.x, leaf.y, leaf.a, time));
  bushes.forEach((bush) => drawBush(ctx, bush.x, bush.y, bush.s));
  rocks.forEach((rock) => drawRock(ctx, rock.x, rock.y, rock.r));
  ironOres.forEach((ore) => drawIronOre(ctx, ore.x, ore.y, ore.r));
  trees.sort((a, b) => a.y - b.y).forEach((tree) => drawTree(ctx, tree));
}

function drawGrass(ctx, x, y, h) {
  ctx.strokeStyle = "rgba(48, 119, 49, 0.48)";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x - 4, y - h * 0.55, x - 9, y - h);
  ctx.moveTo(x + 4, y);
  ctx.quadraticCurveTo(x + 4, y - h * 0.7, x + 7, y - h);
  ctx.moveTo(x + 9, y);
  ctx.quadraticCurveTo(x + 12, y - h * 0.55, x + 17, y - h + 2);
  ctx.stroke();
}

function drawLeaf(ctx, x, y, alpha, time) {
  const bob = Math.sin(time * 0.0015 + x * 0.02) * 2;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.rotate(alpha * Math.PI);
  ctx.fillStyle = alpha > 0.5 ? "rgba(232, 171, 70, 0.4)" : "rgba(91, 149, 54, 0.35)";
  ctx.beginPath();
  ctx.ellipse(0, 0, 9, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBush(ctx, x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = "#4da84c";
  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.ellipse(Math.cos(angle) * 20, Math.sin(angle) * 12, 26, 18, angle, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#6dc85e";
  ctx.beginPath();
  ctx.ellipse(0, -4, 34, 24, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawRock(ctx, x, y, r) {
  ctx.fillStyle = "rgba(39, 48, 35, 0.14)";
  ctx.beginPath();
  ctx.ellipse(x + 6, y + 11, r * 1.1, r * 0.44, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#b8b7a8";
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.7, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.beginPath();
  ctx.ellipse(x - r * 0.28, y - r * 0.22, r * 0.24, r * 0.12, -0.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawIronOre(ctx, x, y, r) {
  ctx.fillStyle = "rgba(39, 48, 35, 0.16)";
  ctx.beginPath();
  ctx.ellipse(x + 6, y + 12, r * 1.12, r * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#59636a";
  ctx.beginPath();
  ctx.moveTo(x - r, y + r * 0.35);
  ctx.lineTo(x - r * 0.65, y - r * 0.7);
  ctx.lineTo(x + r * 0.05, y - r);
  ctx.lineTo(x + r, y - r * 0.25);
  ctx.lineTo(x + r * 0.62, y + r * 0.65);
  ctx.lineTo(x - r * 0.35, y + r * 0.82);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#39454b";
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = "#b86645";
  ctx.beginPath();
  ctx.moveTo(x - r * 0.5, y - r * 0.32);
  ctx.lineTo(x - r * 0.12, y - r * 0.6);
  ctx.lineTo(x + r * 0.35, y - r * 0.25);
  ctx.lineTo(x + r * 0.05, y + r * 0.1);
  ctx.closePath();
  ctx.fill();
}

function drawTree(ctx, tree) {
  ctx.fillStyle = "rgba(39, 48, 35, 0.18)";
  ctx.beginPath();
  ctx.ellipse(tree.x + 8, tree.y + tree.r * 0.9, tree.r * 0.64, tree.r * 0.26, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#8d5a34";
  ctx.fillRect(tree.x - 13, tree.y + tree.r * 0.28, 26, tree.r * 0.72);

  if (tree.kind === "pine") {
    ctx.fillStyle = "#2e7f43";
    drawTriangle(ctx, tree.x, tree.y - 72, tree.r * 1.15, tree.r * 1.25);
    ctx.fillStyle = "#3fa050";
    drawTriangle(ctx, tree.x, tree.y - 32, tree.r * 1.35, tree.r * 1.15);
    ctx.fillStyle = "#58b958";
    drawTriangle(ctx, tree.x, tree.y + 8, tree.r * 1.55, tree.r);
    return;
  }

  ctx.fillStyle = "#3f983e";
  for (let i = 0; i < 7; i += 1) {
    const angle = (i / 7) * Math.PI * 2;
    ctx.beginPath();
    ctx.ellipse(tree.x + Math.cos(angle) * tree.r * 0.34, tree.y + Math.sin(angle) * tree.r * 0.22, tree.r * 0.55, tree.r * 0.43, angle, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#67bd4e";
  ctx.beginPath();
  ctx.ellipse(tree.x, tree.y - 9, tree.r * 0.72, tree.r * 0.58, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawTriangle(ctx, x, y, width, height) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - width / 2, y + height);
  ctx.lineTo(x + width / 2, y + height);
  ctx.closePath();
  ctx.fill();
}

function drawStartingWarehouse(ctx) {
  ctx.save();
  ctx.translate(CONFIG.world.width * 0.5, CONFIG.world.height * 0.5);

  ctx.fillStyle = "rgba(39, 48, 35, 0.13)";
  ctx.beginPath();
  ctx.ellipse(0, 92, 190, 52, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#d5d9d2";
  roundedRect(ctx, -150, -62, 300, 150, 8);
  ctx.fill();
  ctx.strokeStyle = "#68736e";
  ctx.lineWidth = 5;
  ctx.stroke();

  ctx.fillStyle = "#f7f2df";
  roundedRect(ctx, -132, -44, 264, 40, 6);
  ctx.fill();
  ctx.fillStyle = "#6ca9c8";
  for (let i = 0; i < 6; i += 1) {
    roundedRect(ctx, -122 + i * 42, -36, 32, 24, 4);
    ctx.fill();
  }

  ctx.fillStyle = "#59676a";
  roundedRect(ctx, -68, 5, 136, 83, 6);
  ctx.fill();
  ctx.strokeStyle = "#333f42";
  ctx.lineWidth = 4;
  for (let y = 18; y < 78; y += 15) {
    ctx.beginPath();
    ctx.moveTo(-62, y);
    ctx.lineTo(62, y);
    ctx.stroke();
  }

  ctx.fillStyle = "#ffc04d";
  roundedRect(ctx, -52, 44, 104, 36, 5);
  ctx.fill();

  ctx.fillStyle = "#315a62";
  roundedRect(ctx, -166, -78, 332, 28, 7);
  ctx.fill();
  ctx.fillStyle = "#4fa4c8";
  roundedRect(ctx, -152, -72, 304, 9, 4);
  ctx.fill();

  ctx.fillStyle = "#ef9c32";
  roundedRect(ctx, 96, 12, 36, 56, 5);
  ctx.fill();
  ctx.fillStyle = "#415053";
  roundedRect(ctx, 101, 18, 26, 42, 4);
  ctx.fill();
  ctx.fillStyle = "#7bd34c";
  ctx.beginPath();
  ctx.arc(114, 31, 7, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#f3b24d";
  drawCrate(ctx, -128, 48, 42);
  drawCrate(ctx, 96, 72, 38);

  ctx.restore();
}

function drawWarehouseInput(ctx) {
  const inputTile = window.Sproutworks.machines.getWarehouseInputTile();
  const size = CONFIG.world.tileSize;
  const x = inputTile.tileX * size + size / 2;
  const y = inputTile.tileY * size + size / 2;

  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "rgba(39, 48, 35, 0.12)";
  ctx.beginPath();
  ctx.ellipse(0, 16, 44, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#39484b";
  roundedRect(ctx, -30, -24, 60, 48, 8);
  ctx.fill();
  ctx.strokeStyle = "#f0a13b";
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.fillStyle = "#ffd36a";
  ctx.beginPath();
  ctx.moveTo(-14, -8);
  ctx.lineTo(8, -8);
  ctx.lineTo(8, -18);
  ctx.lineTo(25, 0);
  ctx.lineTo(8, 18);
  ctx.lineTo(8, 8);
  ctx.lineTo(-14, 8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawCrate(ctx, x, y, size) {
  ctx.fillRect(x, y, size, size);
  ctx.strokeStyle = "#7a4a28";
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, size, size);
  ctx.beginPath();
  ctx.moveTo(x + 6, y + 6);
  ctx.lineTo(x + size - 6, y + size - 6);
  ctx.moveTo(x + size - 6, y + 6);
  ctx.lineTo(x + 6, y + size - 6);
  ctx.stroke();
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

window.Sproutworks.world = {
  clampToWorld,
  collides,
  drawResourceClearPreview,
  drawWorld,
  isPointInWarehouse,
  removeResourceSourceAt,
  regenerateWorld,
  obstacles,
  rocks,
  ironOres,
  trees,
  warehouse,
};
})();
