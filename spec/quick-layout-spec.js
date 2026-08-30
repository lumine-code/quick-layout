describe("quick-layout", () => {
  let workspaceElement, mainModule;

  beforeEach(async () => {
    workspaceElement = lumine.views.getView(lumine.workspace);
    jasmine.attachToDOM(workspaceElement);
    mainModule = (await lumine.packages.activatePackage("quick-layout")).mainModule;
  });

  function dispatch(command, detail) {
    lumine.commands.dispatch(workspaceElement, command, detail);
  }

  // The layout commands run async pane surgery built purely on microtasks,
  // so flushing a handful of microtask turns settles them.
  async function settle() {
    for (let i = 0; i < 20; i++) {
      await Promise.resolve();
    }
  }

  function getPanes() {
    return lumine.workspace.getCenter().getPanes();
  }

  describe("dock toggles", () => {
    it("toggles the left dock", () => {
      expect(lumine.workspace.getLeftDock().isVisible()).toBe(false);
      dispatch("quick-layout:toggle-left-dock");
      expect(lumine.workspace.getLeftDock().isVisible()).toBe(true);
      dispatch("quick-layout:toggle-left-dock");
      expect(lumine.workspace.getLeftDock().isVisible()).toBe(false);
    });

    it("toggles the bottom and right docks", () => {
      dispatch("quick-layout:toggle-bottom-dock");
      expect(lumine.workspace.getBottomDock().isVisible()).toBe(true);
      dispatch("quick-layout:toggle-right-dock");
      expect(lumine.workspace.getRightDock().isVisible()).toBe(true);
    });
  });

  describe("layout presets", () => {
    it("creates two columns and returns to one pane", async () => {
      await lumine.workspace.open();
      dispatch("quick-layout:two-columns");
      await settle();
      expect(getPanes().length).toBe(2);

      dispatch("quick-layout:one-pane");
      await settle();
      expect(getPanes().length).toBe(1);
    });

    it("creates three columns", async () => {
      await lumine.workspace.open();
      dispatch("quick-layout:three-columns");
      await settle();
      expect(getPanes().length).toBe(3);
    });

    it("creates a 2x2 grid", async () => {
      await lumine.workspace.open();
      dispatch("quick-layout:grid-2x2");
      await settle();
      expect(getPanes().length).toBe(4);
    });

    it("keeps the active item focused when reducing panes", async () => {
      const editor = await lumine.workspace.open();
      dispatch("quick-layout:two-columns");
      await settle();
      dispatch("quick-layout:one-pane");
      await settle();
      expect(lumine.workspace.getCenter().getActivePane().getActiveItem()).toBe(editor);
    });
  });

  describe("item distribution", () => {
    beforeEach(async () => {
      for (let i = 0; i < 4; i++) {
        await lumine.workspace.open();
      }
      dispatch("quick-layout:two-columns");
      await settle();
    });

    it("redistributes items equally across panes", async () => {
      dispatch("quick-layout:redistribute");
      await settle();
      expect(getPanes().map((pane) => pane.getItems().length)).toEqual([2, 2]);
    });

    it("sequentizes items with overflow in the first pane", async () => {
      dispatch("quick-layout:sequentize");
      await settle();
      expect(getPanes().map((pane) => pane.getItems().length)).toEqual([3, 1]);
    });
  });

  describe("title-bar service consumption", () => {
    let titleBar;

    function createFakeTitleBar() {
      const element = document.createElement("div");
      const tiles = [];
      return {
        element,
        tiles,
        addItem({ item, priority }) {
          const tile = {
            item,
            priority,
            destroy() {
              tiles.splice(tiles.indexOf(tile), 1);
              item.remove();
            },
          };
          tiles.push(tile);
          element.appendChild(item);
          return tile;
        },
      };
    }

    beforeEach(() => {
      titleBar = createFakeTitleBar();
      mainModule.consumeTitleBar(titleBar);
    });

    it("adds dock and layout buttons as control tiles", () => {
      expect(titleBar.tiles.length).toBe(9);
      expect(titleBar.element.querySelectorAll(".quick-layout-toggle").length).toBe(3);
      expect(titleBar.element.querySelectorAll(".quick-layout-layout").length).toBe(6);
    });

    it("removes and restores buttons when settings change", () => {
      lumine.config.set("quick-layout.showLayoutButtons", false);
      expect(titleBar.tiles.length).toBe(3);
      expect(titleBar.element.querySelectorAll(".quick-layout-layout").length).toBe(0);

      lumine.config.set("quick-layout.showLayoutButtons", true);
      expect(titleBar.tiles.length).toBe(9);

      lumine.config.set("quick-layout.showDockButtons", false);
      expect(titleBar.element.querySelectorAll(".quick-layout-toggle").length).toBe(0);
    });

    it("toggles a dock when its button is clicked", () => {
      const button = titleBar.element.querySelector("#quick-layout-toggle-left-dock");
      expect(button).not.toBeNull();
      button.click();
      expect(lumine.workspace.getLeftDock().isVisible()).toBe(true);
    });

    it("updates the dock button icon on visibility change", () => {
      const button = titleBar.element.querySelector("#quick-layout-toggle-left-dock");
      const closedIcon = button.innerHTML;
      lumine.workspace.getLeftDock().show();
      expect(button.innerHTML).not.toBe(closedIcon);
      lumine.workspace.getLeftDock().hide();
      expect(button.innerHTML).toBe(closedIcon);
    });
  });
});
