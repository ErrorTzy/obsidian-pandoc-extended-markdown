# Pandoc GUI Export Plan

## Summary

Build the Pandoc GUI as a portable core plus an Obsidian adapter. The target UI is a command-builder surface: a command preview at the top, preset load/save actions near the preview, and editable key/value option rows underneath. The first implementation milestone replaces JSON profile editing with this structured command-builder profile editor, while the same row editor can later power the per-export dialog.

Existing array-based command execution in `src/pandoc/` remains the execution boundary; normal Pandoc profiles must not use shell-string command construction.

## Key Changes

- Add a framework-agnostic `src/pandoc/gui-core/` layer for option metadata, editable command/profile drafts, command previews, validation, and fuzzy search.
- Add a `PandocCatalogService` that builds option metadata from the user's installed Pandoc using `pandoc --version`, `pandoc --help`, `pandoc --list-input-formats`, `pandoc --list-output-formats`, and other list commands when available.
- Try `man pandoc | col -b` for richer descriptions where available; on Windows or when `man` fails, use `pandoc --help` plus list commands.
- Fall back to a bundled manual-derived catalog when local extraction fails or is incomplete.
- Keep `PandocExportProfile` as the persisted format. GUI rows render first-class fields like `-f`/`--from`, `-t`/`--to`, and `-s`/`--standalone` in the same visual language as generic extra args, then compile back into first-class profile fields where possible and into `extraArgs` for generic options.

## Implementation Phases

- Phase 1: Add portable catalog, fuzzy search, validation, profile draft normalization, and command preview logic.
- Phase 2: Replace the raw profile JSON editor with an "Edit pandoc export" button that opens a structured Obsidian command-builder modal matching the sketch: preview first, preset controls second, options rows third.
- Phase 3: Reuse the same key/value editor in the per-file export dialog for one-off extra arguments.
- Phase 4: Keep the GUI core extractable by avoiding Obsidian imports and using adapters for filesystem, picker, notice, and persistence behavior.

## UX Requirements

- Users can load an existing preset, edit it as command rows, save the changes, or save the current command as a new preset.
- Users can add, reorder, remove, and search key/value rows by short key, long key, alias, or description.
- Values use the best available control: format menus for `--from` and `--to`, enum menus for fixed choices, toggles/selects for booleans, numeric inputs for numbers, file/folder pickers for paths where the host supports them, and text inputs with suggestions for open values.
- Each row displays the inferred value type, such as `format string`, `integer`, `folder path`, `file path`, or `flag`.
- The preview shows the final Pandoc command, while execution still uses token arrays.
- Validation warns without blocking when a value cannot be verified because the path is templated, platform-specific, or unavailable.
- The main plugin settings stay clean: enable export, Pandoc path/check, default output behavior, post-export toggles, and the button to open the full editor.

## Test Plan

- Unit tests for catalog extraction from representative `pandoc --help`, `man pandoc`, and fallback catalog fixtures.
- Unit tests for fuzzy matching by `from`, `--from`, `-f`, aliases, and description text.
- Unit tests for value validation: integers, enums, booleans, file paths, folder paths, repeated options, key/value options, and templated paths.
- Unit tests proving profile drafts compile to the same argument arrays as current default profiles.
- Modal tests for opening the profile editor, editing a preset, adding/removing rows, validation display, save/cancel behavior, and command preview updates.
- Run `npm run lint` and `npm test` before commit.

## Assumptions

- First milestone is the profile editor, not the full per-export dialog.
- Runtime Pandoc extraction is preferred; bundled manual-derived data is only fallback.
- The GUI should be extractable later, so core model, validation, matching, and command building must not import Obsidian.
- Network access should not be required at runtime.
- Mobile remains unsupported for execution, but portable core code should not depend on desktop-only APIs.
