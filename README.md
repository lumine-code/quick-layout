# quick-layout

Quick access to predefined pane layouts and dock toggles.

Add buttons to the title bar for fast layout switching.

Fork of [layout-control](https://github.com/rafamel/lumine-layout-control).

## Features

- **Title bar buttons**: quick layout switching with independent title-bar control tiles (requires the `title-bar` package).
- **Dock toggles**: left, bottom, and right dock visibility.
- **Layout presets**: 1-4 columns, 1-3 rows, and 2x2 grid.
- **Hover reveal**: buttons appear on title bar hover.

## Installation

To install `quick-layout` search for _quick-layout_ in the Install pane of the Lumine settings or run `lumine --install lumine-code/quick-layout`.

## Commands

Commands available in `lumine-workspace`:

- `quick-layout:toggle-left-dock`: toggle left dock visibility,
- `quick-layout:toggle-bottom-dock`: toggle bottom dock visibility,
- `quick-layout:toggle-right-dock`: toggle right dock visibility,
- `quick-layout:one-pane`: single pane layout,
- `quick-layout:two-columns`: two columns side by side,
- `quick-layout:three-columns`: three columns side by side,
- `quick-layout:four-columns`: four columns side by side,
- `quick-layout:two-rows`: two rows stacked,
- `quick-layout:three-rows`: three rows stacked,
- `quick-layout:grid-2x2`: 2x2 grid layout,
- `quick-layout:grid-3x3`: 3x3 grid layout,
- `quick-layout:redistribute`: equally redistribute all center items across existing panes,
- `quick-layout:sequentize`: assign 1 item per pane, overflow goes to the first pane.

## Usage

Right-click a layout button to automatically redistribute items after the layout change. Middle-click to sequentize instead.

When switching to a layout with fewer panes, the active item from the previously active pane stays focused.

## Customization

The style can be adjusted according to user preferences in the `styles.css` file:

- e.g. make buttons visible all the time instead of only on hover:

  ```css
  .quick-layout {
    opacity: 1;
    pointer-events: auto;
  }
  ```

- e.g. show four-columns and grid-3x3 buttons (hidden by default):

  ```css
  #quick-layout-four-columns,
  #quick-layout-grid-3x3 {
    display: inline-block;
  }
  ```

- e.g. hide a specific button by id (e.g. `#quick-layout-one-pane`, `#quick-layout-grid-2x2`):

  ```css
  #quick-layout-one-pane {
    display: none;
  }
  ```

- e.g. hide dock toggle buttons but keep layout buttons (or vice versa):

  ```css
  .quick-layout-toggle {
    display: none;
  }
  ```

  ```css
  .quick-layout-layout {
    display: none;
  }
  ```

## Services

- **title-bar** (`^1.0.0`): consumed to add the dock toggle and layout buttons as control tiles in the title bar.

## Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub. Any feedback is welcome!
