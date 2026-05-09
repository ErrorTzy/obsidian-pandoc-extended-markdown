# Development

## Repository Layout

- `src/`: plugin source.
- `src/core/`: plugin entry points, settings, constants, and state.
- `src/live-preview/`: CodeMirror rendering pipeline and widgets.
- `src/reading-mode/`: Reading mode post-processors and parsers.
- `src/editor-extensions/`: editor commands, validation, suggestions, and list editing behavior.
- `src/views/`: sidebar panel UI.
- `src/shared/`: shared patterns, extractors, rendering utilities, types, and helpers.
- `lua_filter/`: Pandoc Lua filters for export support.
- `tests/unit/`: unit tests.
- `tests/integration/`: integration tests.
- `tests/e2e/`: WebdriverIO end-to-end tests.

## Commands

```bash
npm install
npm run dev
npm run build
npm run lint
npm test
npm run test:e2e
npm run test:all
```

Use `npm run dev` for local esbuild development and `npm run build` for production output.

## Testing

- Jest runs unit and integration tests through `npm test`.
- WebdriverIO runs Obsidian E2E tests through `npm run test:e2e`.
- See [tests/README.md](../tests/README.md) for the test directory structure.

Run `npm run lint` before committing. The repository uses short imperative commit summaries, such as `Fix fenced div reference rendering`.

## Architecture

The rendering flow is split by Obsidian mode:

- Live Preview uses CodeMirror extensions and widgets.
- Reading mode uses Markdown post-processing over rendered HTML.
- Source mode is left as plain Markdown.

For detailed architecture and module boundaries, see [ARCHITECTURE.md](../ARCHITECTURE.md).
