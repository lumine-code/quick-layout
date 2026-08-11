const { CompositeDisposable } = require("lumine");

module.exports = {
  subscriptions: null,
  dockButtonSubscriptions: null,
  layoutButtonSubscriptions: null,
  dockTiles: null,
  layoutTiles: null,
  titleBar: null,

  activate() {
    this.subscriptions = new CompositeDisposable(
      lumine.commands.add("lumine-workspace", {
        "quick-layout:toggle-left-dock": () => lumine.workspace.getLeftDock().toggle(),
        "quick-layout:toggle-right-dock": () => lumine.workspace.getRightDock().toggle(),
        "quick-layout:toggle-bottom-dock": () => lumine.workspace.getBottomDock().toggle(),
        "quick-layout:one-pane": (e) => ensurePanes(1, true, e.detail),
        "quick-layout:two-columns": (e) => ensurePanes(2, true, e.detail),
        "quick-layout:three-columns": (e) => ensurePanes(3, true, e.detail),
        "quick-layout:four-columns": (e) => ensurePanes(4, true, e.detail),
        "quick-layout:two-rows": (e) => ensurePanes(2, false, e.detail),
        "quick-layout:three-rows": (e) => ensurePanes(3, false, e.detail),
        "quick-layout:grid-2x2": (e) => ensureGrid(2, e.detail),
        "quick-layout:grid-3x3": (e) => ensureGrid(3, e.detail),
        "quick-layout:redistribute": () => redistributeItems(),
        "quick-layout:sequentize": () => sequentizeItems(),
      }),
      lumine.config.observe("quick-layout.showDockButtons", (value) => {
        if (value) {
          this.addDockButtons();
        } else {
          this.removeDockButtons();
        }
      }),
      lumine.config.observe("quick-layout.showLayoutButtons", (value) => {
        if (value) {
          this.addLayoutButtons();
        } else {
          this.removeLayoutButtons();
        }
      }),
    );
  },

  deactivate() {
    this.removeDockButtons();
    this.removeLayoutButtons();
    this.subscriptions?.dispose();
    this.titleBar = null;
  },

  addDockButtons() {
    if (!this.titleBar || this.dockTiles) return;
    this.dockButtonSubscriptions = new CompositeDisposable();
    this.dockTiles = [];
    const docks = [
      lumine.workspace.getLeftDock(),
      lumine.workspace.getBottomDock(),
      lumine.workspace.getRightDock(),
    ];
    DOCK_BUTTONS.forEach(({ icon, iconOpen, command, title }, i) => {
      const dock = docks[i];
      const btn = createButton(icon, command);
      btn.classList.add("quick-layout", "quick-layout-toggle");
      const updateIcon = (visible) => {
        btn.innerHTML = visible ? iconOpen : icon;
      };
      updateIcon(dock.isVisible());
      this.dockButtonSubscriptions.add(dock.onDidChangeVisible(updateIcon));
      this.dockButtonSubscriptions.add(
        lumine.tooltips.add(btn, {
          title,
          keyBindingCommand: command,
          keyBindingTarget: lumine.views.getView(lumine.workspace),
        }),
      );
      this.dockTiles.push(this.titleBar.addItem({ item: btn, priority: 10 + i }));
    });
    this.subscriptions.add(this.dockButtonSubscriptions);
  },

  removeDockButtons() {
    this.dockTiles?.forEach((tile) => tile.destroy());
    this.dockTiles = null;
    this.dockButtonSubscriptions?.dispose();
    this.dockButtonSubscriptions = null;
  },

  addLayoutButtons() {
    if (!this.titleBar || this.layoutTiles) return;
    this.layoutButtonSubscriptions = new CompositeDisposable();
    this.layoutTiles = [];
    LAYOUT_BUTTONS.forEach(({ icon, command, title }, i) => {
      const btn = createButton(icon, command);
      btn.classList.add("quick-layout", "quick-layout-layout");
      this.layoutButtonSubscriptions.add(
        lumine.tooltips.add(btn, {
          title,
          keyBindingCommand: command,
          keyBindingTarget: lumine.views.getView(lumine.workspace),
        }),
      );
      this.layoutTiles.push(this.titleBar.addItem({ item: btn, priority: 20 + i }));
    });
    this.subscriptions.add(this.layoutButtonSubscriptions);
  },

  removeLayoutButtons() {
    this.layoutTiles?.forEach((tile) => tile.destroy());
    this.layoutTiles = null;
    this.layoutButtonSubscriptions?.dispose();
    this.layoutButtonSubscriptions = null;
  },

  consumeTitleBar(titleBar) {
    if (!titleBar) return;
    this.titleBar = titleBar;
    if (lumine.config.get("quick-layout.showDockButtons")) {
      this.addDockButtons();
    }
    if (lumine.config.get("quick-layout.showLayoutButtons")) {
      this.addLayoutButtons();
    }
  },
};

function getPanes() {
  const allPanes = lumine.workspace.getCenter().getPanes(),
    panesFilter = (prop, name) =>
      allPanes.filter((x) => x[prop] && x[prop].constructor && x[prop].constructor.name === name);
  let panes = panesFilter("parent", "PaneAxis");
  if (!panes.length) panes = panesFilter("activeItem", "TextEditor");
  return panes;
}

function getOrientationPanes(horizontal) {
  const panes = getPanes(),
    orientation = horizontal ? "horizontal" : "vertical";
  return panes.filter((x) => (x.parent.orientation || orientation) === orientation);
}

async function addUntilNPanes(n, horizontal) {
  let panes = getOrientationPanes(horizontal),
    paneCount = panes.length;

  // If no oriented panes, use the active pane to split from
  if (paneCount === 0) {
    const activePane = lumine.workspace.getCenter().getActivePane();
    if (activePane) {
      if (horizontal) activePane.splitRight({ copyActiveItem: false });
      else activePane.splitDown({ copyActiveItem: false });
      panes = getOrientationPanes(horizontal);
      paneCount = panes.length;
    }
    if (paneCount === 0) return;
  } else {
    if (horizontal) panes.slice(-1)[0].splitRight({ copyActiveItem: false });
    else panes.slice(-1)[0].splitDown({ copyActiveItem: false });
  }

  if (paneCount + 1 < n) {
    try {
      await addUntilNPanes(n, horizontal);
    } catch {
      return;
    }
  }
  return;
}

function mergeTwoPanes(lastPane, secondToLastPane) {
  const lastPaneItems = lastPane.getItems();
  for (const item of Array.from(lastPaneItems)) {
    lastPane.moveItemToPane(item, secondToLastPane, secondToLastPane.getItems().length);
  }
  lastPane.destroy();
}

function mergeUntilNPanes(n, horizontal) {
  const result = [];
  let panes = getOrientationPanes(horizontal);
  while (panes.length > n) {
    mergeTwoPanes(panes.slice(-1)[0], panes.slice(-2)[0]);
    result.push((panes = getOrientationPanes(horizontal)));
  }
  return;
}

function redistributeItems() {
  const panes = lumine.workspace.getCenter().getPanes();
  if (panes.length <= 1) return;
  const activeItem = lumine.workspace.getCenter().getActivePane()?.getActiveItem();
  const allItems = [];
  for (const pane of panes) {
    allItems.push(...pane.getItems());
  }
  if (allItems.length <= 1) return;
  const base = Math.floor(allItems.length / panes.length);
  const extra = allItems.length % panes.length;
  let idx = 0;
  for (let i = 0; i < panes.length; i++) {
    const count = base + (i < extra ? 1 : 0);
    for (let j = 0; j < count; j++) {
      const item = allItems[idx++];
      const from = lumine.workspace.paneForItem(item);
      if (from !== panes[i]) {
        from.moveItemToPane(item, panes[i], panes[i].getItems().length);
      }
    }
  }
  if (activeItem) {
    const pane = lumine.workspace.paneForItem(activeItem);
    if (pane) {
      pane.activate();
      pane.activateItem(activeItem);
    }
  }
}

function sequentizeItems() {
  const panes = lumine.workspace.getCenter().getPanes();
  if (panes.length <= 1) return;
  const activeItem = lumine.workspace.getCenter().getActivePane()?.getActiveItem();
  const allItems = [];
  for (const pane of panes) {
    allItems.push(...pane.getItems());
  }
  if (allItems.length <= 1) return;
  const overflow = Math.max(1, allItems.length - panes.length + 1);
  let idx = 0;
  for (let i = 0; i < panes.length; i++) {
    const count = i === 0 ? overflow : 1;
    for (let j = 0; j < count && idx < allItems.length; j++) {
      const item = allItems[idx++];
      const from = lumine.workspace.paneForItem(item);
      if (from !== panes[i]) {
        from.moveItemToPane(item, panes[i], panes[i].getItems().length);
      }
    }
  }
  if (activeItem) {
    const pane = lumine.workspace.paneForItem(activeItem);
    if (pane) {
      pane.activate();
      pane.activateItem(activeItem);
    }
  }
}

async function ensurePanes(n, horizontal, detail) {
  const activeItem = lumine.workspace.getCenter().getActivePane()?.getActiveItem();
  // Collapse nested layouts (grids) to 1 pane first
  const allCenterPanes = lumine.workspace.getCenter().getPanes();
  if (allCenterPanes.some((p) => p.parent?.parent?.constructor?.name === "PaneAxis")) {
    let panes = allCenterPanes;
    while (panes.length > 1) {
      mergeTwoPanes(panes[panes.length - 1], panes[panes.length - 2]);
      panes = lumine.workspace.getCenter().getPanes();
    }
  }
  const revPaneCount = getOrientationPanes(!horizontal).length;
  let paneCount = getOrientationPanes(horizontal).length;
  if (
    (revPaneCount > 0 && paneCount > 1) ||
    (revPaneCount > 1 && paneCount > 0) ||
    (!horizontal && paneCount >= 4 && paneCount % 2 === 0)
  ) {
    let panes = getPanes();
    while (panes.length > 1) {
      mergeTwoPanes(panes.slice(-1)[0], panes.slice(-2)[0]);
      panes = getPanes();
    }
  } else if (revPaneCount > 1) {
    mergeUntilNPanes(1, !horizontal);
  }
  paneCount = getOrientationPanes(horizontal).length;
  if (paneCount < n && n > 1) await addUntilNPanes(n, horizontal);
  else if (paneCount > n) mergeUntilNPanes(n, horizontal);
  if (activeItem) {
    const pane = lumine.workspace.paneForItem(activeItem);
    if (pane) {
      pane.activate();
      pane.activateItem(activeItem);
    }
  }
  if (detail?.redistribute) redistributeItems();
  else if (detail?.sequentize) sequentizeItems();
  return;
}

function ensureGrid(n, detail) {
  ensurePanes(n, false)
    .then(() => {
      const panes = getPanes();
      for (const pane of Array.from(panes)) {
        for (let i = 1; i < n; i++) {
          pane.splitRight({ copyActiveItem: false });
        }
      }
      if (detail?.redistribute) redistributeItems();
      else if (detail?.sequentize) sequentizeItems();
    })
    .catch(() => {});
}

const ICONS = {
  left: '<svg width="14" height="14" viewBox="0 0 14 14"><rect x="0.5" y="0.5" width="13" height="13" rx="1" fill="none" stroke="currentColor" stroke-width="1"/><path d="M5 0.5v13" stroke="currentColor" stroke-width="1"/></svg>',
  leftOpen:
    '<svg width="14" height="14" viewBox="0 0 14 14"><rect x="0.5" y="0.5" width="13" height="13" rx="1" fill="none" stroke="currentColor" stroke-width="1"/><path d="M5 0.5v13" stroke="currentColor" stroke-width="1"/><path d="M1.5 0.5H5V13.5H1.5A1 1 0 0 1 0.5 12.5V1.5A1 1 0 0 1 1.5 0.5Z" fill="currentColor"/></svg>',
  bottom:
    '<svg width="14" height="14" viewBox="0 0 14 14"><rect x="0.5" y="0.5" width="13" height="13" rx="1" fill="none" stroke="currentColor" stroke-width="1"/><path d="M0.5 9h13" stroke="currentColor" stroke-width="1"/></svg>',
  bottomOpen:
    '<svg width="14" height="14" viewBox="0 0 14 14"><rect x="0.5" y="0.5" width="13" height="13" rx="1" fill="none" stroke="currentColor" stroke-width="1"/><path d="M0.5 9h13" stroke="currentColor" stroke-width="1"/><path d="M0.5 9H13.5V12.5A1 1 0 0 1 12.5 13.5H1.5A1 1 0 0 1 0.5 12.5V9Z" fill="currentColor"/></svg>',
  right:
    '<svg width="14" height="14" viewBox="0 0 14 14"><rect x="0.5" y="0.5" width="13" height="13" rx="1" fill="none" stroke="currentColor" stroke-width="1"/><path d="M9 0.5v13" stroke="currentColor" stroke-width="1"/></svg>',
  rightOpen:
    '<svg width="14" height="14" viewBox="0 0 14 14"><rect x="0.5" y="0.5" width="13" height="13" rx="1" fill="none" stroke="currentColor" stroke-width="1"/><path d="M9 0.5v13" stroke="currentColor" stroke-width="1"/><path d="M9 0.5H12.5A1 1 0 0 1 13.5 1.5V12.5A1 1 0 0 1 12.5 13.5H9V0.5Z" fill="currentColor"/></svg>',
  onepane:
    '<svg width="14" height="14" viewBox="0 0 14 14"><rect x="0.5" y="0.5" width="13" height="13" rx="1" fill="none" stroke="currentColor" stroke-width="1"/></svg>',
  twocols:
    '<svg width="14" height="14" viewBox="0 0 14 14"><rect x="0.5" y="0.5" width="13" height="13" rx="1" fill="none" stroke="currentColor" stroke-width="1"/><path d="M7 0.5v13" stroke="currentColor" stroke-width="1"/></svg>',
  threecols:
    '<svg width="14" height="14" viewBox="0 0 14 14"><rect x="0.5" y="0.5" width="13" height="13" rx="1" fill="none" stroke="currentColor" stroke-width="1"/><path d="M5 0.5v13M9 0.5v13" stroke="currentColor" stroke-width="1"/></svg>',
  fourcols:
    '<svg width="14" height="14" viewBox="0 0 14 14"><rect x="0.5" y="0.5" width="13" height="13" rx="1" fill="none" stroke="currentColor" stroke-width="1"/><path d="M3.5 0.5v13M7 0.5v13M10.5 0.5v13" stroke="currentColor" stroke-width="1"/></svg>',
  grid2:
    '<svg width="14" height="14" viewBox="0 0 14 14"><rect x="0.5" y="0.5" width="13" height="13" rx="1" fill="none" stroke="currentColor" stroke-width="1"/><path d="M7 0.5v13M0.5 7h13" stroke="currentColor" stroke-width="1"/></svg>',
  grid3:
    '<svg width="14" height="14" viewBox="0 0 14 14"><rect x="0.5" y="0.5" width="13" height="13" rx="1" fill="none" stroke="currentColor" stroke-width="1"/><path d="M5 0.5v13M9 0.5v13M0.5 5h13M0.5 9h13" stroke="currentColor" stroke-width="1"/></svg>',
};

function createButton(icon, command) {
  const btn = document.createElement("title-bar-tile");
  btn.id = command.replace(":", "-");
  btn.innerHTML = icon;
  btn.addEventListener("click", () => {
    lumine.commands.dispatch(lumine.views.getView(lumine.workspace), command);
  });
  btn.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    lumine.commands.dispatch(lumine.views.getView(lumine.workspace), command, {
      redistribute: true,
    });
  });
  btn.addEventListener("auxclick", (e) => {
    if (e.button !== 1) return;
    e.preventDefault();
    lumine.commands.dispatch(lumine.views.getView(lumine.workspace), command, {
      sequentize: true,
    });
  });
  return btn;
}

const DOCK_BUTTONS = [
  {
    icon: ICONS.left,
    iconOpen: ICONS.leftOpen,
    command: "quick-layout:toggle-left-dock",
    title: () => `Left dock is ${lumine.workspace.getLeftDock().isVisible() ? "open" : "closed"}`,
  },
  {
    icon: ICONS.bottom,
    iconOpen: ICONS.bottomOpen,
    command: "quick-layout:toggle-bottom-dock",
    title: () =>
      `Bottom dock is ${lumine.workspace.getBottomDock().isVisible() ? "open" : "closed"}`,
  },
  {
    icon: ICONS.right,
    iconOpen: ICONS.rightOpen,
    command: "quick-layout:toggle-right-dock",
    title: () => `Right dock is ${lumine.workspace.getRightDock().isVisible() ? "open" : "closed"}`,
  },
];

const LAYOUT_BUTTONS = [
  { icon: ICONS.onepane, command: "quick-layout:one-pane", title: "One pane" },
  { icon: ICONS.twocols, command: "quick-layout:two-columns", title: "Two columns" },
  { icon: ICONS.threecols, command: "quick-layout:three-columns", title: "Three columns" },
  { icon: ICONS.fourcols, command: "quick-layout:four-columns", title: "Four columns" },
  { icon: ICONS.grid2, command: "quick-layout:grid-2x2", title: "2×2 grid" },
  { icon: ICONS.grid3, command: "quick-layout:grid-3x3", title: "3×3 grid" },
];
