(() => {
window.Sproutworks = window.Sproutworks || {};

window.Sproutworks.CONFIG = {
  world: {
    width: 8800,
    height: 6400,
    tileSize: 64,
  },
  camera: {
    startX: 4400,
    startY: 3200,
    keyboardSpeed: 520,
    dragSensitivity: 1,
    minZoom: 0.62,
    maxZoom: 2.15,
    wheelZoomStrength: 0.0012,
  },
  resources: {
    coin: 100,
    stone: 120,
    iron: 110,
    wood: 180,
  },
  storage: {
    resourceMax: 500,
    unitMax: 300,
    depotRange: 980,
  },
  mapReload: {
    coinCost: 500,
    code: "MAP-RELOAD",
    durationMs: 1500,
  },
  upgrades: {
    warehouse: {
      wood: 250,
      stone: 150,
      iron: 75,
      coin: 50,
    },
  },
  machines: {
    conveyorLaneUpgrade: {
      maxLevel: 3,
      cost: {
        iron: 12,
        wood: 18,
      },
    },
    woodCollector: {
      cost: {
        stone: 20,
        iron: 12,
        wood: 30,
      },
      widthTiles: 2,
      heightTiles: 2,
      range: 180,
      productionAmount: 1,
      productionSeconds: 2,
    },
    stoneCollector: {
      cost: {
        stone: 30,
        iron: 15,
        wood: 35,
      },
      widthTiles: 2,
      heightTiles: 2,
      range: 180,
      productionAmount: 1,
      productionSeconds: 2.5,
    },
    ironCollector: {
      cost: {
        stone: 45,
        iron: 25,
        wood: 45,
      },
      widthTiles: 2,
      heightTiles: 2,
      range: 180,
      productionAmount: 1,
      productionSeconds: 3,
    },
    conveyorStraight: {
      cost: {
        iron: 1,
        wood: 1,
      },
    },
    conveyorCorner: {
      cost: {
        iron: 1,
        wood: 2,
      },
    },
    conveyorMerger: {
      cost: {
        iron: 3,
        wood: 4,
      },
    },
    conveyorSplitter: {
      cost: {
        iron: 3,
        wood: 4,
      },
    },
    conveyorPriority2: {
      cost: {
        iron: 4,
        wood: 4,
      },
    },
    conveyorPriority3: {
      cost: {
        iron: 5,
        wood: 5,
      },
    },
    conveyorConditional: {
      cost: {
        iron: 4,
        wood: 3,
      },
    },
    conveyorOverflow: {
      cost: {
        iron: 4,
        wood: 3,
      },
    },
    conveyorFilter: {
      cost: {
        iron: 5,
        wood: 3,
      },
    },
    trashCan: {
      cost: {
        iron: 8,
        stone: 10,
      },
    },
    storageUnit: {
      cost: {
        coin: 25,
        stone: 55,
        iron: 30,
        wood: 60,
      },
      widthTiles: 3,
      heightTiles: 2,
      outputSeconds: 1.2,
    },
    storageDepot: {
      cost: {
        wood: 250,
        stone: 150,
        iron: 75,
        coin: 50,
      },
      widthTiles: 4,
      heightTiles: 3,
    },
  },
};
})();
