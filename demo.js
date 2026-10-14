// Authentic package usage. Run with lumine/script/demo.js; fixtures stay in demo/.
module.exports = {
  version: 1,
  dependencies: ["language-javascript", "tree-view"],
  viewport: { width: 1200, height: 760 },
  async before() {},
  async prepare(context) {
    const { lumine, state, fixture, open } = context;
    state.editor = await open("Signal Lab/src/signal.js");
    await lumine.project.setPaths([fixture("Signal Lab")]);
  },
  scenes: [
    {
      id: "scene-1",
      file: "demo.png",
      caption: "Arrange two source panes side by side.",
      timeout: 60000,
      async run(context) {
        const { lumine, state, fixture } = context;
        {
          lumine.commands.dispatch(lumine.views.getView(state.editor), "quick-layout:two-columns");
          lumine.workspace.getCenter().getPanes()[1].activate();
          await lumine.workspace.open(fixture("Signal Lab/README.md"));
          lumine.workspace.getCenter().getPanes()[0].activateItem(state.editor);
        }
      },
      ready(context) {
        const { lumine } = context;
        return Boolean(lumine.workspace.getCenter().getPanes().length === 2);
      },
    },
  ],
  async cleanup() {},
};
