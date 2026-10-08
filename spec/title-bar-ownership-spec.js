const path = require("path");

describe("quick-layout title-bar service ownership", () => {
  let mainModule, bars, providers, tooltips, dockSubscriptions;

  function provide(bar) {
    const provider = lumine.packages.serviceHub.provide("title-bar", "1.0.0", bar);
    providers.push(provider);
    return provider;
  }

  function createBar() {
    const { ControlTiles } = require(
      path.join(lumine.packages.resolvePackagePath("title-bar"), "lib/control-tiles"),
    );
    const element = document.createElement("div");
    jasmine.attachToDOM(element);
    const bar = new ControlTiles(element);
    bars.push(bar);
    return bar;
  }

  beforeEach(async () => {
    jasmine.attachToDOM(lumine.views.getView(lumine.workspace));
    mainModule = (await lumine.packages.activatePackage("quick-layout")).mainModule;
    bars = [];
    providers = [];
    tooltips = [];
    dockSubscriptions = [];
    const addTooltip = lumine.tooltips.add.bind(lumine.tooltips);
    spyOn(lumine.tooltips, "add").and.callFake((...args) => {
      const subscription = addTooltip(...args);
      spyOn(subscription, "dispose").and.callThrough();
      tooltips.push(subscription);
      return subscription;
    });
    for (const dock of [
      lumine.workspace.getLeftDock(),
      lumine.workspace.getBottomDock(),
      lumine.workspace.getRightDock(),
    ]) {
      const subscribe = dock.onDidChangeVisible.bind(dock);
      spyOn(dock, "onDidChangeVisible").and.callFake((callback) => {
        const subscription = subscribe(callback);
        spyOn(subscription, "dispose").and.callThrough();
        dockSubscriptions.push(subscription);
        return subscription;
      });
    }
  });

  afterEach(async () => {
    for (const provider of providers) provider.dispose();
    if (lumine.packages.isPackageActive("quick-layout")) {
      await lumine.packages.deactivatePackage("quick-layout");
    }
    for (const bar of bars) bar.destroy();
  });

  it("owns controls independently for overlapping bars delivered by the service hub", () => {
    const oldBar = createBar();
    const oldProvider = provide(oldBar);
    const currentBar = createBar();
    provide(currentBar);
    expect(oldBar.getTiles().length).toBe(9);
    expect(currentBar.getTiles().length).toBe(9);
    const currentButton = currentBar.element.querySelector("#quick-layout-toggle-left-dock");

    oldProvider.dispose();

    expect(oldBar.getTiles().length).toBe(0);
    expect(currentBar.getTiles().length).toBe(9);
    expect(currentButton?.isConnected).toBe(true);
    currentButton?.click();
    expect(lumine.workspace.getLeftDock().isVisible()).toBe(true);
  });

  it("shares one bar's controls until the last provider of the same object retires", () => {
    const bar = createBar();
    const first = provide(bar);
    const second = provide(bar);
    const button = bar.element.querySelector("#quick-layout-toggle-left-dock");
    expect(bar.getTiles().length).toBe(9);
    first.dispose();
    expect(bar.getTiles().length).toBe(9);
    expect(bar.element.querySelector("#quick-layout-toggle-left-dock")).toBe(button);

    second.dispose();
    expect(bar.getTiles().length).toBe(0);
  });

  it("applies configuration to every live bar without replacing unaffected controls", () => {
    const oldBar = createBar();
    provide(oldBar);
    const currentBar = createBar();
    provide(currentBar);
    const dockButton = currentBar.element.querySelector("#quick-layout-toggle-left-dock");
    lumine.config.set("quick-layout.showLayoutButtons", false);
    expect(oldBar.getTiles().length).toBe(3);
    expect(currentBar.getTiles().length).toBe(3);
    lumine.config.set("quick-layout.showLayoutButtons", true);
    expect(oldBar.getTiles().length).toBe(9);
    expect(currentBar.getTiles().length).toBe(9);
    expect(currentBar.element.querySelector("#quick-layout-toggle-left-dock")).toBe(dockButton);
  });

  it("removes the retired bar's tooltips, dock listeners and detached button handlers", () => {
    const oldBar = createBar();
    const oldProvider = provide(oldBar);
    const oldButton = oldBar.element.querySelector("#quick-layout-toggle-left-dock");
    const oldTooltips = tooltips.slice();
    const oldDockSubscriptions = dockSubscriptions.slice();
    const currentBar = createBar();
    provide(currentBar);
    oldProvider.dispose();
    const icon = oldButton.innerHTML;
    oldButton.click();
    expect(lumine.workspace.getLeftDock().isVisible()).toBe(false);
    lumine.workspace.getLeftDock().show();
    expect(oldButton.innerHTML).toBe(icon);
    expect(oldButton.isConnected).toBe(false);
    for (const subscription of [...oldTooltips, ...oldDockSubscriptions]) {
      expect(subscription.dispose).toHaveBeenCalledTimes(1);
    }
    for (const subscription of tooltips.slice(oldTooltips.length)) {
      expect(subscription.dispose).not.toHaveBeenCalled();
    }
  });

  it("retains an older live bar when the newer provider disappears first", () => {
    const oldBar = createBar();
    provide(oldBar);
    const currentBar = createBar();
    provide(currentBar).dispose();
    expect(oldBar.getTiles().length).toBe(9);
    expect(currentBar.getTiles().length).toBe(0);
    lumine.config.set("quick-layout.showDockButtons", false);
    expect(oldBar.getTiles().length).toBe(6);
  });

  it("does not let a retired activation's direct edge remove newer controls on the same bar", async () => {
    const bar = createBar();
    const oldEdge = mainModule.consumeTitleBar(bar);
    await lumine.packages.deactivatePackage("quick-layout");
    mainModule = (await lumine.packages.activatePackage("quick-layout")).mainModule;
    const currentEdge = mainModule.consumeTitleBar(bar);
    oldEdge.dispose();
    expect(bar.getTiles().length).toBe(9);
    currentEdge.dispose();
    expect(bar.getTiles().length).toBe(0);
  });
});
