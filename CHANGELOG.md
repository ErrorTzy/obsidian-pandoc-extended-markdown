# Changelog

All notable changes to this project will be documented in this file.

## [1.3.2] - 2025-08-21

### Changed
- Major code refactoring for improved maintainability and performance
- Restructured codebase with new modular architecture:
  - Added `PluginStateManager` for centralized state management
  - Created dedicated `ReadingModeParser` and `ReadingModeRenderer` classes
  - Introduced `ProcessorConfig` for better configuration handling
- Enhanced widget system for better rendering of decorations
- Improved parsing logic for example lists and super/subscript text
- Optimized reading mode processing with more efficient rendering pipeline

### Technical Improvements
- Better separation of concerns between parsing and rendering logic
- Improved type safety with TypeScript interfaces
- Enhanced code organization with clearer module boundaries
- More maintainable and testable codebase structure

## [1.3.1] - Previous Release

### Added
- Show content on hover for example lists in reading mode
- Example lists auto-completion improvements

### Fixed
- Example list rendering in reading mode bug
- Auto-formatting bug: heading in the first line of the document will not be added a blank line
- Example lists numbering bug

### Changed
- Optimized code structure
- Updated README with known limitations documentation