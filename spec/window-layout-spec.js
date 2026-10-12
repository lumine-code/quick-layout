describe("quick-layout presentation windows", () => {
  let titleBar;
  beforeEach(async () => {
    jasmine.useRealClock();
    jasmine.attachToDOM(lumine.workspace.getElement());
    titleBar = (await lumine.packages.activatePackage("title-bar")).mainModule.provideTitleBar();
    await lumine.packages.activatePackage("quick-layout");
  });
  afterEach(async () => {
    await lumine.workspace.discardEditorWindows();
  });

  async function settle() {
    for (let i = 0; i < 20; i++) await Promise.resolve();
  }

  it("adds layout controls to existing and future windows, with docks only in main", async () => {
    const extra = await lumine.workspace.openEditorWindow({ show: false });
    expect(titleBar.forWindow(extra).getTiles().length).toBe(7); // Six presets and the core reattach pin.
    expect(extra.getElement().querySelectorAll(".quick-layout-layout").length).toBe(6);
    expect(extra.getElement().querySelectorAll(".quick-layout-toggle").length).toBe(0);
    const main = lumine.workspace.getMainWindow();
    expect(main.getElement().querySelectorAll(".quick-layout-toggle").length).toBe(3);
    extra.getElement().querySelector("#quick-layout-grid-2x2").click();
    await settle();
    expect(extra.getEditorContainer().getPanes().length).toBe(4);
    expect(main.getEditorContainer().getPanes().length).toBe(1);
    await lumine.packages.deactivatePackage("quick-layout");
    for (const window of lumine.workspace.getWindows())
      expect(window.getElement().querySelectorAll(".quick-layout").length).toBe(0);
  });

  it("captures the invoking container while the global editor belongs to another window", async () => {
    const main = lumine.workspace.getMainWindow();
    const mainEditor = await lumine.workspace.open();
    const extra = await lumine.workspace.openEditorWindow({ show: false });
    const extraEditor = lumine.workspace.buildTextEditor();
    extra.getEditorContainer().getActivePane().activateItem(extraEditor, { activatePane: true });
    expect(lumine.workspace.getActiveTextEditor()).toBe(extraEditor);
    lumine.commands.dispatch(main.getElement(), "quick-layout:grid-3x3");
    extra.getEditorContainer().getActivePane().activate();
    await settle();
    expect(main.getEditorContainer().getPanes().length).toBe(9);
    expect(extra.getEditorContainer().getPanes().length).toBe(1);
    expect(extra.getEditorContainer().getPaneItems()).toEqual([extraEditor]);
    expect(main.getEditorContainer().getPaneItems()).toEqual([mainEditor]);
  });

  it("redistributes only tabs in the invoking window", async () => {
    const mainEditor = await lumine.workspace.open();
    const extra = await lumine.workspace.openEditorWindow({ show: false });
    const pane = extra.getEditorContainer().getActivePane();
    const editors = [lumine.workspace.buildTextEditor(), lumine.workspace.buildTextEditor()];
    for (const editor of editors) pane.addItem(editor);
    pane.splitRight({ activate: false });
    lumine.commands.dispatch(extra.getElement(), "quick-layout:redistribute");
    await settle();
    expect(
      extra
        .getEditorContainer()
        .getPanes()
        .map((pane) => pane.getItems().length),
    ).toEqual([1, 1]);
    expect(lumine.workspace.getMainWindow().getEditorContainer().getPaneItems()).toEqual([
      mainEditor,
    ]);
  });
});
