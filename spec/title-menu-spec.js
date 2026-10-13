describe("Quick Layout title tile menus", () => {
  let main, window, tooltips;
  beforeEach(async () => {
    jasmine.useRealClock();
    jasmine.attachToDOM(lumine.workspace.getElement());
    tooltips = spyOn(lumine.tooltips, "add").and.callThrough();
    await lumine.packages.activatePackage("title-bar");
    main = (await lumine.packages.activatePackage("quick-layout")).mainModule;
    window = lumine.workspace.getMainWindow();
  });
  afterEach(async () => {
    await lumine.packages.deactivatePackage("quick-layout");
    await lumine.workspace.discardEditorWindows();
  });
  const menu = (tile) => lumine.contextMenu.templateForElement(tile);
  it("lists all layout variants with their mouse shortcuts and leaves right click inert", () => {
    const tile = window.getElement().querySelector("#quick-layout-two-columns");
    const actions = menu(tile).filter((item) => item.command);
    expect(actions.map((item) => item.mouseBindingLabel)).toEqual(["LMB", "Alt+LMB", "MMB"]);
    expect(actions.map((item) => item.commandDetail)).toEqual([
      undefined,
      { redistribute: true },
      { sequentize: true },
    ]);
    const dispatch = spyOn(lumine.commands, "dispatch");
    tile.remove();
    tile.dispatchEvent(new MouseEvent("mousedown", { button: 2, bubbles: true }));
    const event = new MouseEvent("contextmenu", { button: 2, bubbles: true, cancelable: true });
    tile.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
    tile.dispatchEvent(new MouseEvent("click", { button: 0, altKey: true }));
    expect(dispatch).toHaveBeenCalledWith(window.getElement(), "quick-layout:two-columns", {
      redistribute: true,
    });
    tile.dispatchEvent(new MouseEvent("auxclick", { button: 1 }));
    expect(dispatch).toHaveBeenCalledWith(window.getElement(), "quick-layout:two-columns", {
      sequentize: true,
    });
  });
  it("reads dock visibility when opened and keeps state and the primary action in plain tooltips", () => {
    const tile = window.getElement().querySelector("#quick-layout-toggle-left-dock");
    const dock = lumine.workspace.getLeftDock();
    dock.hide();
    expect(menu(tile).find((item) => item.command).checked).toBe(false);
    dock.show();
    expect(menu(tile).find((item) => item.command).checked).toBe(true);
    expect(menu(tile).find((item) => item.command).mouseBindingLabel).toBe("LMB / MMB");
    const options = tooltips.calls.all().find((call) => call.args[0] === tile).args[1];
    expect(options.keyBindingCommand).toBeUndefined();
    expect(options.keyBindingExtra).toBeUndefined();
    expect(options.title()).toBe("Left dock is open. Toggle this dock.");
  });
  it("dispatches a menu layout to its own window and preserves the tile's no-drag region", async () => {
    const extra = await lumine.workspace.openEditorWindow({ show: false });
    const tile = extra.getElement().querySelector("#quick-layout-grid-2x2");
    const action = menu(tile).find((item) => item.commandDetail?.redistribute);
    expect(getComputedStyle(tile).getPropertyValue("-webkit-app-region")).toBe("no-drag");
    await lumine.commands.dispatch(tile, action.command, action.commandDetail);
    for (let i = 0; i < 20; i++) await Promise.resolve();
    expect(extra.getEditorContainer().getPanes().length).toBe(4);
    expect(window.getEditorContainer().getPanes().length).toBe(1);
    expect(tile.getAttribute("data-context-menu-boundary")).toBe("");
  });
  it("disposes menu definitions and detached button handlers with the service edge", () => {
    const connection = main.titleBars.values().next().value;
    const tile = window.getElement().querySelector("#quick-layout-two-columns");
    main.releaseTitleBar(connection);
    expect(menu(tile)).toEqual([]);
    const dispatch = spyOn(lumine.commands, "dispatch");
    tile.click();
    tile.dispatchEvent(new MouseEvent("auxclick", { button: 1 }));
    expect(dispatch).not.toHaveBeenCalled();
  });
});
