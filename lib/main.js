const { CompositeDisposable, Disposable } = require("lumine");

module.exports = {
  provideBackgroundTips() {
    return {
      packageName: "quick-layout",
      tips: [
        "You can rearrange your panes into two columns with {{ 'quick-layout:two-columns' | keystroke }}",
      ],
    };
  },

  subscriptions: null,
  titleBars: null,
  titleBar: null,

  activate() {
    this.titleBars = new Map();
    this.titleBar = null;
    this.subscriptions = new CompositeDisposable(
      lumine.commands.add("lumine-workspace", {
        "quick-layout:toggle-left-dock": {
          description: "Show or hide the dock on the left.",
          didDispatch: () => lumine.workspace.getLeftDock().toggle(),
        },
        "quick-layout:toggle-right-dock": {
          description: "Show or hide the dock on the right.",
          didDispatch: () => lumine.workspace.getRightDock().toggle(),
        },
        "quick-layout:toggle-bottom-dock": {
          description: "Show or hide the dock along the bottom.",
          didDispatch: () => lumine.workspace.getBottomDock().toggle(),
        },
        "quick-layout:one-pane": {
          description: "Collapse every split back into a single pane.",
          didDispatch: (e) => ensurePanes(editorContainer(e), 1, true, e.detail),
        },
        "quick-layout:two-columns": {
          description: "Arrange the panes as two columns.",
          didDispatch: (e) => ensurePanes(editorContainer(e), 2, true, e.detail),
        },
        "quick-layout:three-columns": {
          description: "Arrange the panes as three columns.",
          didDispatch: (e) => ensurePanes(editorContainer(e), 3, true, e.detail),
        },
        "quick-layout:four-columns": {
          description: "Arrange the panes as four columns.",
          didDispatch: (e) => ensurePanes(editorContainer(e), 4, true, e.detail),
        },
        "quick-layout:two-rows": {
          description: "Arrange the panes as two rows.",
          didDispatch: (e) => ensurePanes(editorContainer(e), 2, false, e.detail),
        },
        "quick-layout:three-rows": {
          description: "Arrange the panes as three rows.",
          didDispatch: (e) => ensurePanes(editorContainer(e), 3, false, e.detail),
        },
        "quick-layout:grid-2x2": {
          description: "Arrange the panes as a two-by-two grid.",
          didDispatch: (e) => ensureGrid(editorContainer(e), 2, e.detail),
        },
        "quick-layout:grid-3x3": {
          description: "Arrange the panes as a three-by-three grid.",
          didDispatch: (e) => ensureGrid(editorContainer(e), 3, e.detail),
        },
        "quick-layout:redistribute": {
          description: "Give every pane an equal share of the space.",
          didDispatch: (e) => redistributeItems(editorContainer(e)),
        },
        "quick-layout:sequentize": {
          description: "Spread the open tabs one to a pane, in order.",
          didDispatch: (e) => sequentizeItems(editorContainer(e)),
        },
      }),
      lumine.config.observe("quick-layout.showDockButtons", (value) => {
        for (const connection of this.titleBars.values()) {
          if (value) this.addDockButtons(connection);
          else this.removeDockButtons(connection);
        }
      }),
      lumine.config.observe("quick-layout.showLayoutButtons", (value) => {
        for (const connection of this.titleBars.values()) {
          if (value) this.addLayoutButtons(connection);
          else this.removeLayoutButtons(connection);
        }
      }),
    );
  },

  deactivate() {
    for (const connection of this.titleBars.values()) this.releaseTitleBar(connection);
    this.subscriptions?.dispose();
    this.titleBar = null;
  },

  addDockButtons(connection = this.titleBars.get(this.titleBar)) {
    if (!connection || !connection.context.window.isMain() || connection.dockTiles) return;
    connection.dockButtonSubscriptions = new CompositeDisposable();
    connection.dockTiles = [];
    const docks = [
      lumine.workspace.getLeftDock(),
      lumine.workspace.getBottomDock(),
      lumine.workspace.getRightDock(),
    ];
    DOCK_BUTTONS.forEach(({ icon, iconOpen, command, title }, i) => {
      const dock = docks[i];
      const btn = createButton(
        connection.context.window,
        icon,
        command,
        connection.dockButtonSubscriptions,
      );
      btn.classList.add("quick-layout", "quick-layout-toggle");
      const updateIcon = (visible) => {
        btn.innerHTML = visible ? iconOpen : icon;
      };
      updateIcon(dock.isVisible());
      connection.dockButtonSubscriptions.add(dock.onDidChangeVisible(updateIcon));
      connection.dockButtonSubscriptions.add(
        lumine.tooltips.add(btn, {
          title: () => `${title()}. Toggle this dock.`,
        }),
      );
      connection.dockTiles.push(connection.titleBar.addItem({ item: btn, priority: 10 + i }));
    });
  },

  removeDockButtons(connection = this.titleBars.get(this.titleBar)) {
    if (!connection) return;
    connection.dockButtonSubscriptions?.dispose();
    connection.dockButtonSubscriptions = null;
    connection.dockTiles?.forEach((tile) => tile.destroy());
    connection.dockTiles = null;
  },

  addLayoutButtons(connection = this.titleBars.get(this.titleBar)) {
    if (!connection || connection.layoutTiles) return;
    connection.layoutButtonSubscriptions = new CompositeDisposable();
    connection.layoutTiles = [];
    LAYOUT_BUTTONS.forEach(({ icon, command, title }, i) => {
      const btn = createButton(
        connection.context.window,
        icon,
        command,
        connection.layoutButtonSubscriptions,
      );
      btn.classList.add("quick-layout", "quick-layout-layout");
      connection.layoutButtonSubscriptions.add(
        lumine.tooltips.add(btn, {
          title: () => {
            const count = connection.context.window.getEditorContainer().getPanes().length;
            return `${count} pane${count === 1 ? "" : "s"}. Apply ${title.toLowerCase()} layout.`;
          },
        }),
      );
      connection.layoutTiles.push(connection.titleBar.addItem({ item: btn, priority: 20 + i }));
    });
  },

  removeLayoutButtons(connection = this.titleBars.get(this.titleBar)) {
    if (!connection) return;
    connection.layoutButtonSubscriptions?.dispose();
    connection.layoutButtonSubscriptions = null;
    connection.layoutTiles?.forEach((tile) => tile.destroy());
    connection.layoutTiles = null;
  },

  releaseTitleBar(connection) {
    if (this.titleBars.get(connection.titleBar) !== connection) return;
    this.removeDockButtons(connection);
    this.removeLayoutButtons(connection);
    this.titleBars.delete(connection.titleBar);
    if (this.titleBar === connection.titleBar) {
      this.titleBar = [...this.titleBars.keys()].at(-1) ?? null;
    }
  },

  consumeTitleBar(service) {
    return service.observeWindows(
      (scopedTitleBar, context) => this.consumeWindowTitleBar(scopedTitleBar, context),
      { windows: "all" },
    );
  },

  consumeWindowTitleBar(titleBar, context) {
    if (!titleBar) return;
    let connection = this.titleBars.get(titleBar);
    if (!connection) {
      connection = { titleBar, context, references: 0 };
      this.titleBars.set(titleBar, connection);
    }
    connection.references++;
    this.titleBar = titleBar;
    if (lumine.config.get("quick-layout.showDockButtons")) {
      this.addDockButtons(connection);
    }
    if (lumine.config.get("quick-layout.showLayoutButtons")) {
      this.addLayoutButtons(connection);
    }
    return new Disposable(() => {
      if (this.titleBars.get(titleBar) !== connection) return;
      if (--connection.references === 0) this.releaseTitleBar(connection);
    });
  },
};

function editorContainer(event) {
  const window =
    event?.context?.window ??
    lumine.workspace.getFocusedWindow() ??
    lumine.workspace.getMainWindow();
  return window.getEditorContainer();
}

function getPanes(container) {
  return container.getPanes();
}

function getOrientationPanes(container, horizontal) {
  const panes = getPanes(container),
    orientation = horizontal ? "horizontal" : "vertical";
  return panes.filter((x) => (x.parent.orientation || orientation) === orientation);
}

async function addUntilNPanes(container, n, horizontal) {
  let panes = getOrientationPanes(container, horizontal),
    paneCount = panes.length;

  // If no oriented panes, use the active pane to split from
  if (paneCount === 0) {
    const activePane = container.getActivePane();
    if (activePane) {
      if (horizontal) activePane.splitRight();
      else activePane.splitDown();
      panes = getOrientationPanes(container, horizontal);
      paneCount = panes.length;
    }
    if (paneCount === 0) return;
  } else {
    if (horizontal) panes.slice(-1)[0].splitRight();
    else panes.slice(-1)[0].splitDown();
  }

  if (getOrientationPanes(container, horizontal).length < n) {
    try {
      await addUntilNPanes(container, n, horizontal);
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
  if (!lastPane.isDestroyed()) lastPane.destroy();
}

function mergePanesIntoActivePane(panes, activePane) {
  let index = 0;
  for (const pane of panes) {
    for (const item of Array.from(pane.getItems())) {
      if (pane !== activePane) pane.moveItemToPane(item, activePane, index);
      index++;
    }
  }
  for (const pane of panes) {
    if (pane !== activePane && !pane.isDestroyed()) pane.destroy();
  }
}

function mergeUntilNPanes(container, n, horizontal) {
  const result = [];
  let panes = getOrientationPanes(container, horizontal);
  while (panes.length > n) {
    mergeTwoPanes(panes.slice(-1)[0], panes.slice(-2)[0]);
    result.push((panes = getOrientationPanes(container, horizontal)));
  }
  return;
}

function redistributeItems(container) {
  const panes = container.getPanes();
  if (panes.length <= 1) return;
  const activeItem = container.getActivePane()?.getActiveItem();
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
      pane.activateItem(activeItem);
      pane.activate();
    }
  }
}

function sequentizeItems(container) {
  const panes = container.getPanes();
  if (panes.length <= 1) return;
  const activeItem = container.getActivePane()?.getActiveItem();
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
      pane.activateItem(activeItem);
      pane.activate();
    }
  }
}

async function ensurePanes(container, n, horizontal, detail) {
  const center = container;
  const activePane = center.getActivePane();
  const activeItem = activePane?.getActiveItem();
  const allCenterPanes = center.getPanes();
  if (n === 1 && allCenterPanes.length > 1 && activePane) {
    mergePanesIntoActivePane(allCenterPanes, activePane);
    return;
  }
  // Collapse nested layouts (grids) to 1 pane first
  if (allCenterPanes.some((p) => p.parent?.parent?.constructor?.name === "PaneAxis")) {
    let panes = allCenterPanes;
    while (panes.length > 1) {
      mergeTwoPanes(panes[panes.length - 1], panes[panes.length - 2]);
      panes = container.getPanes();
    }
  }
  const revPaneCount = getOrientationPanes(container, !horizontal).length;
  let paneCount = getOrientationPanes(container, horizontal).length;
  if (
    (revPaneCount > 0 && paneCount > 1) ||
    (revPaneCount > 1 && paneCount > 0) ||
    (!horizontal && paneCount >= 4 && paneCount % 2 === 0)
  ) {
    let panes = getPanes(container);
    while (panes.length > 1) {
      mergeTwoPanes(panes.slice(-1)[0], panes.slice(-2)[0]);
      panes = getPanes(container);
    }
  } else if (revPaneCount > 1) {
    mergeUntilNPanes(container, 1, !horizontal);
  }
  paneCount = getOrientationPanes(container, horizontal).length;
  if (paneCount < n && n > 1) await addUntilNPanes(container, n, horizontal);
  else if (paneCount > n) mergeUntilNPanes(container, n, horizontal);
  if (activeItem) {
    const pane = lumine.workspace.paneForItem(activeItem);
    if (pane) {
      pane.activateItem(activeItem);
      pane.activate();
    }
  }
  if (detail?.redistribute) redistributeItems(container);
  else if (detail?.sequentize) sequentizeItems(container);
  return;
}

function ensureGrid(container, n, detail) {
  ensurePanes(container, n, false)
    .then(() => {
      const panes = getPanes(container);
      for (const pane of Array.from(panes)) {
        for (let i = 1; i < n; i++) {
          pane.splitRight();
        }
      }
      if (detail?.redistribute) redistributeItems(container);
      else if (detail?.sequentize) sequentizeItems(container);
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

function createButton(window, icon, command, subscriptions) {
  const btn = window.getDocument().createElement("title-bar-tile");
  btn.id = command.replace(":", "-");
  btn.setAttribute("data-context-menu-boundary", "");
  btn.innerHTML = icon;
  const layout = !command.startsWith("quick-layout:toggle-");
  const dispatch = (detail) =>
    detail === undefined
      ? lumine.commands.dispatch(window.getElement(), command)
      : lumine.commands.dispatch(window.getElement(), command, detail);
  const onClick = (e) => {
    if (e.button !== 0 || (process.platform === "darwin" && e.ctrlKey)) return;
    dispatch(layout && e.altKey ? { redistribute: true } : undefined);
  };
  const onAuxClick = (e) => {
    if (e.button !== 1) return;
    e.preventDefault();
    dispatch(layout ? { sequentize: true } : undefined);
  };
  const label = command
    .split(":")[1]
    .split("-")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
  const belongsToTile = (event) => event.target.closest?.("title-bar-tile") === btn;
  const actions = layout
    ? [
        { label: `Apply ${label}`, command, mouseBindingLabel: "LMB" },
        {
          label: "Apply and Redistribute Items",
          command,
          commandDetail: { redistribute: true },
          mouseBindingLabel: "Alt+LMB",
        },
        {
          label: "Apply and Sequentize Items",
          command,
          commandDetail: { sequentize: true },
          mouseBindingLabel: "MMB",
        },
      ]
    : [
        {
          label,
          command,
          type: "checkbox",
          mouseBindingLabel: "LMB / MMB",
          created() {
            this.checked = lumine.workspace[`get${label.split(" ")[1]}Dock`]().isVisible();
          },
        },
      ];
  subscriptions.add(
    lumine.contextMenu.add({
      [`title-bar-tile#${btn.id}`]: [
        { type: "separator" },
        ...actions.map((action) => ({ ...action, shouldDisplay: belongsToTile })),
        { type: "separator" },
      ],
    }),
  );
  btn.addEventListener("click", onClick);
  btn.addEventListener("auxclick", onAuxClick);
  subscriptions.add(
    new Disposable(() => {
      btn.removeEventListener("click", onClick);
      btn.removeEventListener("auxclick", onAuxClick);
    }),
  );
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
