(() => {
window.Sproutworks = window.Sproutworks || {};

function createInput() {
  const input = {
    up: false,
    down: false,
    left: false,
    right: false,
    dragX: 0,
    dragY: 0,
    zoomEvents: [],
    clickEvents: [],
    pointerScreen: null,
    pointerWorld: null,
  };

  const keyMap = {
    KeyW: "up",
    ArrowUp: "up",
    KeyS: "down",
    ArrowDown: "down",
    KeyA: "left",
    ArrowLeft: "left",
    KeyD: "right",
    ArrowRight: "right",
  };

  function isTypingTarget(target) {
    return target?.matches?.("input, textarea, select, [contenteditable='true']");
  }

  window.addEventListener("keydown", (event) => {
    if (isTypingTarget(event.target)) return;

    if (event.code === "KeyR" && (window.Sproutworks.state?.buildMode || window.Sproutworks.state?.movingMachineId)) {
      event.preventDefault();
      window.Sproutworks.machines.rotateBuildMode();
      return;
    }
    if (event.code === "KeyF" && (window.Sproutworks.state?.buildMode || window.Sproutworks.state?.movingMachineId)) {
      event.preventDefault();
      window.Sproutworks.machines.mirrorBuildMode();
      return;
    }
    if (event.code === "Escape" && (window.Sproutworks.state?.buildMode || window.Sproutworks.state?.demolishMode || window.Sproutworks.state?.moveMode || window.Sproutworks.state?.harvestMode || window.Sproutworks.state?.sourceClearMode)) {
      event.preventDefault();
      window.Sproutworks.state.buildMode = null;
      window.Sproutworks.state.demolishMode = false;
      window.Sproutworks.state.moveMode = false;
      window.Sproutworks.state.harvestMode = false;
      window.Sproutworks.state.sourceClearMode = false;
      window.Sproutworks.state.movingMachineId = null;
      window.Sproutworks.state.moveRotation = 0;
      window.Sproutworks.state.moveMirrored = false;
      window.Sproutworks.state.buildMirrored = false;
      document.querySelector("#demolishButton")?.classList.remove("active");
      document.querySelector("#moveButton")?.classList.remove("active");
      document.querySelector("#harvestButton")?.classList.remove("active");
      document.querySelector("#sourceClearButton")?.classList.remove("active");
      window.Sproutworks.ui.setBuildHintVisible(false);
      return;
    }

    const actionButton = {
      KeyB: "#buildMenuButton",
      KeyX: "#demolishButton",
      KeyM: "#moveButton",
      KeyH: "#harvestButton",
      KeyQ: "#sourceClearButton",
    }[event.code];
    if (actionButton) {
      event.preventDefault();
      document.querySelector(actionButton)?.click();
      return;
    }

    const direction = keyMap[event.code];
    if (!direction) return;
    event.preventDefault();
    input[direction] = true;
  });

  window.addEventListener("keyup", (event) => {
    if (isTypingTarget(event.target)) return;

    const direction = keyMap[event.code];
    if (!direction) return;
    event.preventDefault();
    input[direction] = false;
  });

  return input;
}

function setupUi(input) {
  const { CONFIG, state } = window.Sproutworks;
  const canvas = document.querySelector("#gameCanvas");
  const menuButton = document.querySelector("#menuButton");
  const shopButton = document.querySelector("#shopButton");
  const menuPanel = document.querySelector("#menuPanel");
  const reloadMapButton = document.querySelector("#reloadMapButton");
  const resetGameButton = document.querySelector("#resetGameButton");
  const codeInput = document.querySelector("#codeInput");
  const codeButton = document.querySelector("#codeButton");
  const codeMessage = document.querySelector("#codeMessage");
  const mapLoadingScreen = document.querySelector("#mapLoadingScreen");
  const shopPanel = document.querySelector("#shopPanel");
  const closeMenuButton = document.querySelector("#closeMenuButton");
  const closeShopButton = document.querySelector("#closeShopButton");
  const warehousePanel = document.querySelector("#warehousePanel");
  const closeWarehouseButton = document.querySelector("#closeWarehouseButton");
  const machineInfoPanel = document.querySelector("#machineInfoPanel");
  const closeMachineInfoButton = document.querySelector("#closeMachineInfoButton");
  const buildMenuButton = document.querySelector("#buildMenuButton");
  const demolishButton = document.querySelector("#demolishButton");
  const moveButton = document.querySelector("#moveButton");
  const harvestButton = document.querySelector("#harvestButton");
  const sourceClearButton = document.querySelector("#sourceClearButton");
  const buildPanel = document.querySelector("#buildPanel");
  const closeBuildButton = document.querySelector("#closeBuildButton");
  const buildWoodCollectorButton = document.querySelector("#buildWoodCollectorButton");
  const buildStoneCollectorButton = document.querySelector("#buildStoneCollectorButton");
  const buildIronCollectorButton = document.querySelector("#buildIronCollectorButton");
  const buildConveyorStraightButton = document.querySelector("#buildConveyorStraightButton");
  const buildConveyorCornerButton = document.querySelector("#buildConveyorCornerButton");
  const buildConveyorMergerButton = document.querySelector("#buildConveyorMergerButton");
  const buildConveyorSplitterButton = document.querySelector("#buildConveyorSplitterButton");
  const buildConveyorConditionalButton = document.querySelector("#buildConveyorConditionalButton");
  const buildConveyorOverflowButton = document.querySelector("#buildConveyorOverflowButton");
  const buildConveyorFilterButton = document.querySelector("#buildConveyorFilterButton");
  const buildStorageUnitButton = document.querySelector("#buildStorageUnitButton");
  const buildTrashCanButton = document.querySelector("#buildTrashCanButton");
  const statusToast = document.querySelector("#statusToast");
  const categoryTabs = document.querySelectorAll(".category-tab");
  const buildCategories = document.querySelectorAll(".build-category");
  const buildHint = document.querySelector("#buildHint");
  const buildTray = document.querySelector("#buildTray");
  const rotateBuildButton = document.querySelector("#rotateBuildButton");
  const mirrorBuildButton = document.querySelector("#mirrorBuildButton");
  const cancelBuildButton = document.querySelector("#cancelBuildButton");
  const controlModeToggle = document.querySelector("#controlModeToggle");
  const touchHint = document.querySelector("#touchHint");
  const resourceBar = document.querySelector("#resourceBar");
  const controlState = {
    touchMode: false,
    dragging: false,
    lastX: 0,
    lastY: 0,
    pinchDistance: 0,
    moved: false,
    totalMove: 0,
    pointers: new Map(),
  };
  let reloadCodeUnlocked = false;
  let reloadInProgress = false;
  let toastTimer = 0;
  const buildButtons = [
    [buildWoodCollectorButton, "woodCollector"],
    [buildStoneCollectorButton, "stoneCollector"],
    [buildIronCollectorButton, "ironCollector"],
    [buildConveyorStraightButton, "conveyorStraight"],
    [buildConveyorCornerButton, "conveyorCorner"],
    [buildConveyorMergerButton, "conveyorMerger"],
    [buildConveyorSplitterButton, "conveyorSplitter"],
    [buildConveyorConditionalButton, "conveyorConditional"],
    [buildConveyorOverflowButton, "conveyorOverflow"],
    [buildConveyorFilterButton, "conveyorFilter"],
    [buildStorageUnitButton, "storageUnit"],
    [buildTrashCanButton, "trashCan"],
  ];

  const mobileByDefault = matchMedia("(pointer: coarse)").matches;
  updateResourceCounters(resourceBar, state.resources);
  refreshBuildCards();
  window.setInterval(refreshBuildCards, 500);
  setTouchMode(mobileByDefault);

  menuButton.addEventListener("click", () => {
    menuPanel.hidden = !menuPanel.hidden;
    shopPanel.hidden = true;
    buildPanel.hidden = true;
    machineInfoPanel.hidden = true;
  });

  codeButton.addEventListener("click", () => {
    const enteredCode = codeInput.value.trim().toUpperCase();
    if (enteredCode !== CONFIG.mapReload.code) {
      codeMessage.textContent = "Code nicht erkannt.";
      codeMessage.classList.add("error");
      return;
    }
    reloadCodeUnlocked = true;
    codeMessage.textContent = "Map-Reload freigeschaltet.";
    codeMessage.classList.remove("error");
    reloadMapButton.textContent = "Neue Map laden · Code aktiviert";
  });

  codeInput.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (event.code === "Enter") {
      event.preventDefault();
      codeButton.click();
    }
  });

  codeInput.addEventListener("keyup", (event) => {
    event.stopPropagation();
  });

  reloadMapButton.addEventListener("click", () => {
    if (reloadInProgress) return;
    if (!reloadCodeUnlocked && state.resources.coin < CONFIG.mapReload.coinCost) {
      codeMessage.textContent = "Du brauchst 500 Coin oder einen passenden Code.";
      codeMessage.classList.add("error");
      return;
    }
    if (!reloadCodeUnlocked) state.resources.coin -= CONFIG.mapReload.coinCost;
    reloadInProgress = true;
    state.buildMode = null;
    state.demolishMode = false;
    state.moveMode = false;
    state.harvestMode = false;
    state.sourceClearMode = false;
    state.movingMachineId = null;
    state.moveRotation = 0;
    state.moveMirrored = false;
    state.buildMirrored = false;
    window.Sproutworks.machines.refundAllBuildings();
    menuPanel.hidden = true;
    mapLoadingScreen.hidden = false;
    reloadMapButton.disabled = true;
    setBuildHintVisible(false);
    window.setTimeout(() => {
      window.Sproutworks.world.regenerateWorld();
      state.harvestCooldown = 0;
      state.harvestAnimation = null;
      reloadInProgress = false;
      reloadMapButton.disabled = false;
      mapLoadingScreen.hidden = true;
      reloadCodeUnlocked = false;
      codeInput.value = "";
      reloadMapButton.textContent = "Neue Map laden · 500 Coin";
      window.Sproutworks.save?.markSaveDirty();
    }, CONFIG.mapReload.durationMs);
  });

  resetGameButton.addEventListener("click", () => {
    const shouldReset = window.confirm("Wirklich alles zuruecksetzen? Deine Fabrik und alle Ressourcen werden geloescht.");
    if (!shouldReset) return;
    window.Sproutworks.save.resetGame();
    menuPanel.hidden = true;
    shopPanel.hidden = true;
    buildPanel.hidden = true;
    warehousePanel.hidden = true;
    machineInfoPanel.hidden = true;
    demolishButton.classList.remove("active");
    moveButton.classList.remove("active");
    harvestButton.classList.remove("active");
    sourceClearButton.classList.remove("active");
    setBuildHintVisible(false);
    updateResourceCounters(resourceBar, state.resources);
  });

  shopButton.addEventListener("click", () => {
    shopPanel.hidden = !shopPanel.hidden;
    menuPanel.hidden = true;
    warehousePanel.hidden = true;
    buildPanel.hidden = true;
    machineInfoPanel.hidden = true;
  });

  buildMenuButton.addEventListener("click", () => {
    state.demolishMode = false;
    state.moveMode = false;
    state.harvestMode = false;
    state.sourceClearMode = false;
    state.movingMachineId = null;
    state.moveRotation = 0;
    state.moveMirrored = false;
    demolishButton.classList.remove("active");
    moveButton.classList.remove("active");
    harvestButton.classList.remove("active");
    sourceClearButton.classList.remove("active");
    setBuildHintVisible(Boolean(state.buildMode));
    buildPanel.hidden = !buildPanel.hidden;
    menuPanel.hidden = true;
    shopPanel.hidden = true;
    warehousePanel.hidden = true;
    machineInfoPanel.hidden = true;
  });

  demolishButton.addEventListener("click", () => {
    state.demolishMode = !state.demolishMode;
    state.buildMode = null;
    state.moveMode = false;
    state.harvestMode = false;
    state.sourceClearMode = false;
    state.movingMachineId = null;
    state.moveRotation = 0;
    state.moveMirrored = false;
    state.buildMirrored = false;
    buildPanel.hidden = true;
    menuPanel.hidden = true;
    shopPanel.hidden = true;
    warehousePanel.hidden = true;
    machineInfoPanel.hidden = true;
    demolishButton.classList.toggle("active", state.demolishMode);
    moveButton.classList.remove("active");
    harvestButton.classList.remove("active");
    sourceClearButton.classList.remove("active");
    setBuildHintVisible(state.demolishMode, "Bagger: Teil anklicken zum Loeschen · halbe Kosten zurueck");
  });

  moveButton.addEventListener("click", () => {
    state.moveMode = !state.moveMode;
    state.buildMode = null;
    state.demolishMode = false;
    state.harvestMode = false;
    state.sourceClearMode = false;
    state.movingMachineId = null;
    state.moveMirrored = false;
    buildPanel.hidden = true;
    menuPanel.hidden = true;
    shopPanel.hidden = true;
    warehousePanel.hidden = true;
    machineInfoPanel.hidden = true;
    demolishButton.classList.remove("active");
    harvestButton.classList.remove("active");
    sourceClearButton.classList.remove("active");
    moveButton.classList.toggle("active", state.moveMode);
    setBuildHintVisible(state.moveMode, "Move: Teil auswaehlen und neue Stelle anklicken");
  });

  harvestButton.addEventListener("click", () => {
    state.harvestMode = !state.harvestMode;
    state.buildMode = null;
    state.demolishMode = false;
    state.moveMode = false;
    state.sourceClearMode = false;
    state.movingMachineId = null;
    state.moveMirrored = false;
    buildPanel.hidden = true;
    menuPanel.hidden = true;
    shopPanel.hidden = true;
    warehousePanel.hidden = true;
    machineInfoPanel.hidden = true;
    demolishButton.classList.remove("active");
    moveButton.classList.remove("active");
    sourceClearButton.classList.remove("active");
    harvestButton.classList.toggle("active", state.harvestMode);
    setBuildHintVisible(state.harvestMode, "Abbauen: Baum, Stein oder Eisenerz anklicken · Cooldown 1 s");
  });

  sourceClearButton.addEventListener("click", () => {
    state.sourceClearMode = !state.sourceClearMode;
    state.buildMode = null;
    state.demolishMode = false;
    state.moveMode = false;
    state.harvestMode = false;
    state.movingMachineId = null;
    state.moveMirrored = false;
    buildPanel.hidden = true;
    menuPanel.hidden = true;
    shopPanel.hidden = true;
    warehousePanel.hidden = true;
    machineInfoPanel.hidden = true;
    demolishButton.classList.remove("active");
    moveButton.classList.remove("active");
    harvestButton.classList.remove("active");
    sourceClearButton.classList.toggle("active", state.sourceClearMode);
    setBuildHintVisible(state.sourceClearMode, "Quellen: Baum, Stein oder Eisenerz anklicken zum Entfernen");
  });

  closeMenuButton.addEventListener("click", () => {
    menuPanel.hidden = true;
  });

  closeShopButton.addEventListener("click", () => {
    shopPanel.hidden = true;
  });

  closeWarehouseButton.addEventListener("click", () => {
    warehousePanel.hidden = true;
  });

  closeMachineInfoButton.addEventListener("click", () => {
    machineInfoPanel.hidden = true;
  });

  closeBuildButton.addEventListener("click", () => {
    buildPanel.hidden = true;
  });

  rotateBuildButton.addEventListener("click", () => {
    if (!state.buildMode && !state.movingMachineId) return;
    window.Sproutworks.machines.rotateBuildMode();
  });

  mirrorBuildButton.addEventListener("click", () => {
    if (!state.buildMode && !state.movingMachineId) return;
    window.Sproutworks.machines.mirrorBuildMode();
  });

  cancelBuildButton.addEventListener("click", () => {
    state.buildMode = null;
    state.demolishMode = false;
    state.moveMode = false;
    state.harvestMode = false;
    state.sourceClearMode = false;
    state.movingMachineId = null;
    state.moveRotation = 0;
    state.moveMirrored = false;
    state.buildMirrored = false;
    demolishButton.classList.remove("active");
    moveButton.classList.remove("active");
    harvestButton.classList.remove("active");
    sourceClearButton.classList.remove("active");
    setBuildHintVisible(false);
  });

  buildWoodCollectorButton.addEventListener("click", () => {
    startBuildMode("woodCollector");
  });

  buildStoneCollectorButton.addEventListener("click", () => {
    startBuildMode("stoneCollector");
  });

  buildIronCollectorButton.addEventListener("click", () => {
    startBuildMode("ironCollector");
  });

  buildConveyorStraightButton.addEventListener("click", () => {
    startBuildMode("conveyorStraight");
  });

  buildConveyorCornerButton.addEventListener("click", () => {
    startBuildMode("conveyorCorner");
  });

  buildConveyorMergerButton.addEventListener("click", () => {
    startBuildMode("conveyorMerger");
  });

  buildConveyorSplitterButton.addEventListener("click", () => {
    startBuildMode("conveyorSplitter");
  });

  buildConveyorConditionalButton.addEventListener("click", () => {
    startBuildMode("conveyorConditional");
  });

  buildConveyorOverflowButton.addEventListener("click", () => {
    startBuildMode("conveyorOverflow");
  });

  buildConveyorFilterButton.addEventListener("click", () => {
    startBuildMode("conveyorFilter");
  });

  buildStorageUnitButton.addEventListener("click", () => {
    startBuildMode("storageUnit");
  });

  buildTrashCanButton.addEventListener("click", () => {
    startBuildMode("trashCan");
  });

  categoryTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const category = tab.dataset.category;
      categoryTabs.forEach((item) => item.classList.toggle("active", item === tab));
      buildCategories.forEach((panel) => {
        panel.classList.toggle("active", panel.dataset.buildCategory === category);
      });
    });
  });

  controlModeToggle.addEventListener("change", () => {
    setTouchMode(controlModeToggle.checked);
  });

  canvas.addEventListener("pointerdown", (event) => {
    input.pointerScreen = { x: event.clientX, y: event.clientY };
    if (!controlState.touchMode || event.pointerType === "mouse") return;
    event.preventDefault();
    controlState.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    controlState.dragging = controlState.pointers.size === 1;
    controlState.moved = false;
    controlState.totalMove = 0;
    controlState.pinchDistance = getPinchDistance(controlState.pointers);
    controlState.lastX = event.clientX;
    controlState.lastY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener("pointermove", (event) => {
    input.pointerScreen = { x: event.clientX, y: event.clientY };
    if (!controlState.touchMode || !controlState.pointers.has(event.pointerId)) return;
    event.preventDefault();
    controlState.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (controlState.pointers.size >= 2) {
      const nextDistance = getPinchDistance(controlState.pointers);
      const center = getPinchCenter(controlState.pointers);
      if (controlState.pinchDistance > 0 && nextDistance > 0) {
        input.zoomEvents.push({
          factor: nextDistance / controlState.pinchDistance,
          screenX: center.x,
          screenY: center.y,
        });
      }
      controlState.pinchDistance = nextDistance;
      controlState.dragging = false;
      controlState.moved = true;
      return;
    }

    if (!controlState.dragging) {
      controlState.dragging = true;
      controlState.lastX = event.clientX;
      controlState.lastY = event.clientY;
      return;
    }

    const moveX = event.clientX - controlState.lastX;
    const moveY = event.clientY - controlState.lastY;
    input.dragX += moveX;
    input.dragY += moveY;
    controlState.totalMove += Math.hypot(moveX, moveY);
    if (controlState.totalMove > 8) {
      controlState.moved = true;
    }
    controlState.lastX = event.clientX;
    controlState.lastY = event.clientY;
  });

  canvas.addEventListener("pointerup", (event) => {
    if (controlState.touchMode && event.pointerType !== "mouse" && controlState.pointers.size === 1 && !controlState.moved) {
      input.clickEvents.push({ screenX: event.clientX, screenY: event.clientY });
    }
    stopPointer(event.pointerId);
  });
  canvas.addEventListener("pointercancel", (event) => stopPointer(event.pointerId));

  canvas.addEventListener("click", (event) => {
    input.pointerScreen = { x: event.clientX, y: event.clientY };
    if (controlState.touchMode && event.pointerType !== "mouse") return;
    input.clickEvents.push({ screenX: event.clientX, screenY: event.clientY });
  });

  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    input.zoomEvents.push({
      factor: Math.exp(-event.deltaY * 0.0012),
      screenX: event.clientX,
      screenY: event.clientY,
    });
  }, { passive: false });

  function stopPointer(pointerId) {
    controlState.pointers.delete(pointerId);
    controlState.dragging = false;
    controlState.pinchDistance = getPinchDistance(controlState.pointers);
    const firstPointer = controlState.pointers.values().next().value;
    if (firstPointer) {
      controlState.lastX = firstPointer.x;
      controlState.lastY = firstPointer.y;
    }
  }

  function setTouchMode(enabled) {
    controlState.touchMode = enabled;
    controlModeToggle.checked = enabled;
    touchHint.hidden = !enabled;
    clearInput(input);
  }

  function startBuildMode(type) {
    if (!window.Sproutworks.machines.canAfford(CONFIG.machines[type].cost)) {
      showToast(`Fehlt: ${getMissingCostText(CONFIG.machines[type].cost)}.`);
      refreshBuildCards();
      return;
    }
    state.buildMode = type;
    state.demolishMode = false;
    state.moveMode = false;
    state.harvestMode = false;
    state.sourceClearMode = false;
    state.movingMachineId = null;
    state.moveRotation = 0;
    state.buildRotation = 0;
    state.moveMirrored = false;
    state.buildMirrored = false;
    demolishButton.classList.remove("active");
    moveButton.classList.remove("active");
    harvestButton.classList.remove("active");
    sourceClearButton.classList.remove("active");
    machineInfoPanel.hidden = true;
    warehousePanel.hidden = true;
    buildPanel.hidden = true;
    setBuildHintVisible(true);
  }

  function refreshBuildCards() {
    buildButtons.forEach(([button, type]) => {
      if (!button) return;
      const cost = CONFIG.machines[type].cost;
      const missingText = getMissingCostText(cost);
      const canBuild = missingText === "";
      button.classList.toggle("unavailable", !canBuild);
      let status = button.querySelector(".build-card-status");
      if (!status) {
        status = document.createElement("span");
        status.className = "build-card-status";
        button.appendChild(status);
      }
      status.textContent = canBuild ? "Baubar" : `Fehlt: ${missingText}`;
    });
  }

  function showToast(message) {
    if (!statusToast) return;
    window.clearTimeout(toastTimer);
    statusToast.textContent = message;
    statusToast.hidden = false;
    toastTimer = window.setTimeout(() => {
      statusToast.hidden = true;
    }, 1800);
  }

  return controlState;
}

function clearInput(input) {
  input.up = false;
  input.down = false;
  input.left = false;
  input.right = false;
  input.dragX = 0;
  input.dragY = 0;
  input.zoomEvents.length = 0;
  input.clickEvents.length = 0;
  input.pointerWorld = null;
}

function getPinchDistance(pointers) {
  const points = Array.from(pointers.values());
  if (points.length < 2) return 0;
  return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
}

function getPinchCenter(pointers) {
  const points = Array.from(pointers.values());
  return {
    x: (points[0].x + points[1].x) / 2,
    y: (points[0].y + points[1].y) / 2,
  };
}

window.Sproutworks.ui = {
  createInput,
  showMachineInfoPanel,
  showWarehousePanel,
  showToast,
  setupUi,
  setBuildHintVisible,
  updateResourceCounters,
  updateFactoryStatus,
  updateSaveStatus,
};

function showToast(message) {
  const statusToast = document.querySelector("#statusToast");
  if (!statusToast) return;
  statusToast.textContent = message;
  statusToast.hidden = false;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    statusToast.hidden = true;
  }, 1800);
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
    conveyorConditional: "Bedingungsfoerderband",
    conveyorOverflow: "Ueberlauf-Band",
    conveyorFilter: "Filterfoerderband",
    storageUnit: "Lagerbauteil",
    trashCan: "Muelleimer",
  }[type] ?? "dieses Teil";
}

function getMissingCostText(cost) {
  const { state } = window.Sproutworks;
  const missing = Object.entries(cost ?? {})
    .map(([resource, amount]) => [resource, amount - (state.resources[resource] ?? 0)])
    .filter(([, amount]) => amount > 0);
  return missing.map(([resource, amount]) => `${amount} ${getResourceLabel(resource)}`).join(" · ");
}

function updateResourceCounters(resourceBar, resources) {
  const { CONFIG } = window.Sproutworks;
  resourceBar.querySelectorAll(".resource-counter").forEach((counter) => {
    const resourceName = counter.dataset.resource;
    const value = resources[resourceName] ?? 0;
    const max = resourceName === "coin" ? "" : `/${CONFIG.storage.resourceMax}`;
    counter.querySelector("strong").textContent = `${value}${max}`;
  });
}

function updateFactoryStatus(factoryStatus) {
  if (!factoryStatus) return;
  const { state } = window.Sproutworks;
  const factories = state.machines.filter((machine) => (
    machine.type === "woodCollector"
    || machine.type === "stoneCollector"
    || machine.type === "ironCollector"
  ));
  const storages = state.machines.filter((machine) => machine.type === "storageUnit");
  const activeFactories = factories.filter((machine) => machine.status === "working").length;
  const blocked = state.machines.filter((machine) => machine.status === "blocked").length;
  const idle = factories.filter((machine) => machine.status === "no-source" || machine.status === "no-output").length;

  factoryStatus.innerHTML = `
    <div class="factory-status-row"><span>Fabriken aktiv</span><strong>${activeFactories}/${factories.length}</strong></div>
    <div class="factory-status-row"><span>Blockiert</span><strong>${blocked}</strong></div>
    <div class="factory-status-row"><span>Wartet</span><strong>${idle}</strong></div>
    <div class="factory-status-row"><span>Items auf Band</span><strong>${state.items.length}</strong></div>
    <div class="factory-status-row"><span>Extra-Lager</span><strong>${storages.length}</strong></div>
  `;
}

function updateSaveStatus(saveStatus) {
  if (!saveStatus) return;
  const dirty = Boolean(window.Sproutworks.state.saveDirty);
  saveStatus.textContent = dirty ? "Speichert ..." : "Gespeichert";
  saveStatus.classList.toggle("dirty", dirty);
}

function showMachineInfoPanel(machine) {
  const panel = document.querySelector("#machineInfoPanel");
  const title = document.querySelector("#machineInfoTitle");
  const body = document.querySelector("#machineInfoBody");
  if (!panel || !title || !body || !machine) return;

  const { CONFIG } = window.Sproutworks;
  const cost = CONFIG.machines[machine.type]?.cost ?? {};
  const status = getMachineStatusText(machine);
  const rotationText = ["Rechts", "Unten", "Links", "Oben"][machine.rotation % 4] ?? "Rechts";
  const costText = Object.entries(cost).length > 0
    ? Object.entries(cost).map(([resource, amount]) => `${amount} ${getResourceLabel(resource)}`).join(" · ")
    : "Kostenlos";
  const storageRows = machine.type === "storageUnit"
    ? Object.entries(machine.storage ?? {}).map(([resource, amount]) => `
      <div class="machine-info-row"><span>${getResourceLabel(resource)}</span><strong>${amount}/${CONFIG.storage.unitMax}</strong></div>
    `).join("")
    : "";
  const counterRow = machine.type === "conveyorConditional" || machine.type === "conveyorOverflow"
    ? `<div class="machine-info-row"><span>Durchgelassen</span><strong>${machine.passedCount ?? 0}</strong></div>`
    : "";
  const filterRow = machine.type === "conveyorFilter"
    ? `
      <label class="machine-info-row machine-info-select-row">
        <span>Erlaubtes Item</span>
        <select id="filterResourceSelect">
          <option value="wood"${machine.filterResource === "wood" ? " selected" : ""}>Holz</option>
          <option value="stone"${machine.filterResource === "stone" ? " selected" : ""}>Stein</option>
          <option value="iron"${machine.filterResource === "iron" ? " selected" : ""}>Eisen</option>
        </select>
      </label>
    `
    : "";

  title.textContent = getBuildName(machine.type);
  body.innerHTML = `
    <div class="machine-info-row"><span>Status</span><strong>${status}</strong></div>
    <div class="machine-info-row"><span>Groesse</span><strong>${machine.widthTiles ?? 1}x${machine.heightTiles ?? 1}</strong></div>
    <div class="machine-info-row"><span>Richtung</span><strong>${rotationText}${machine.mirrored ? " gespiegelt" : ""}</strong></div>
    <div class="machine-info-row"><span>Baumaterial</span><strong>${costText}</strong></div>
    ${counterRow}
    ${filterRow}
    ${storageRows}
    <p class="machine-info-note">${getMachineNote(machine)}</p>
  `;

  const filterSelect = document.querySelector("#filterResourceSelect");
  filterSelect?.addEventListener("change", () => {
    machine.filterResource = filterSelect.value;
    window.Sproutworks.save?.markSaveDirty();
    showToast(`Filter: nur ${getResourceLabel(machine.filterResource)}.`);
  });

  document.querySelector("#menuPanel").hidden = true;
  document.querySelector("#shopPanel").hidden = true;
  document.querySelector("#buildPanel").hidden = true;
  document.querySelector("#warehousePanel").hidden = true;
  panel.hidden = false;
}

function getMachineStatusText(machine) {
  return {
    working: "Laeuft",
    blocked: "Blockiert",
    "no-source": "Keine Ressource",
    "no-output": "Kein Ausgang",
    empty: "Leer",
  }[machine.status] ?? (machine.connected ? "Verbunden" : "Wartet");
}

function getMachineNote(machine) {
  if (machine.status === "blocked") return "Das naechste Band ist voll. Loese den Stau oder baue mehr Weg.";
  if (machine.status === "no-source") return "Diese Fabrik muss naeher an Baum, Stein oder Erz stehen.";
  if (machine.status === "no-output") return "Setze ein passendes Foerderband direkt an den Ausgang.";
  if (machine.type === "storageUnit") return "Gruen ist Eingang, Blau ist Ausgang. Das Lager zaehlt extra zum Hauptlager.";
  if (machine.type === "conveyorConditional") return "Dieses Band laesst Items nur rein, wenn dahinter noch Lagerplatz erreichbar ist. Rot bedeutet: Ziel voll.";
  if (machine.type === "conveyorOverflow") return "Dieses Band laesst Items nur durch, wenn das Ziel-Lager voll ist.";
  if (machine.type === "conveyorFilter") return "Dieses Band blockt alle Items ausser der ausgewaehlten Ressource.";
  if (machine.type === "trashCan") return "Zeigt ein Foerderband auf den Muelleimer, wird das Item dort geloescht.";
  if (machine.type?.startsWith("conveyor")) return "Items folgen bei jedem Band neu der Richtung dieses Teils.";
  return "Diese Maschine produziert automatisch, wenn Quelle und Foerderband passen.";
}

function getResourceLabel(resource) {
  return {
    coin: "Coin",
    wood: "Holz",
    stone: "Stein",
    iron: "Eisen",
  }[resource] ?? resource;
}

function showWarehousePanel() {
  document.querySelector("#menuPanel").hidden = true;
  document.querySelector("#shopPanel").hidden = true;
  document.querySelector("#buildPanel").hidden = true;
  document.querySelector("#machineInfoPanel").hidden = true;
  document.querySelector("#warehousePanel").hidden = false;
}

function setBuildHintVisible(visible, text = "Bauen: Klicken zum Platzieren · R drehen · F spiegeln") {
  const buildHint = document.querySelector("#buildHint");
  const buildTray = document.querySelector("#buildTray");
  const rotateButton = document.querySelector("#rotateBuildButton");
  const mirrorButton = document.querySelector("#mirrorBuildButton");
  buildHint.textContent = text;
  buildHint.hidden = !visible;
  buildTray.hidden = !visible;
  const hideTransformButtons = Boolean(window.Sproutworks.state?.demolishMode || window.Sproutworks.state?.harvestMode || (window.Sproutworks.state?.moveMode && !window.Sproutworks.state?.movingMachineId));
  rotateButton.hidden = hideTransformButtons;
  mirrorButton.hidden = hideTransformButtons;
}
})();
