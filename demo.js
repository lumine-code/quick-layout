// Authentic package usage. Run with lumine/script/demo.js; fixtures stay in demo/.
module.exports = {
  version: 1,
  dependencies: ["language-javascript", "tree-view", "title-bar"],
  viewport: { width: 840, height: 760 },
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
          await lumine.commands.dispatch(
            lumine.views.getView(state.editor),
            "quick-layout:two-columns",
          );
          lumine.workspace.getCenter().getPanes()[1].activate();
          await lumine.workspace.open(fixture("Signal Lab/README.md"));
          lumine.workspace.getCenter().getPanes()[0].activateItem(state.editor);
        }
      },
      // The runner's pointer rests over the controls at this viewport width.
      afterPointerMove({ lumine }) {
        for (const tooltips of lumine.tooltips.tooltips.values())
          for (const tooltip of tooltips) tooltip.cancel();
      },
      ready(context) {
        const { lumine } = context;
        const panes = lumine.workspace.getCenter().getPanes();
        return (
          panes.length === 2 &&
          getComputedStyle(document.querySelector("#quick-layout-two-columns")).opacity === "1" &&
          panes.every((pane) => {
            const editor = pane.getActiveItem();
            return (
              editor?.getText?.().length > 0 &&
              editor.getElement().getBoundingClientRect().height > 0
            );
          })
        );
      },
    },
  ],
  async cleanup() {},
};
