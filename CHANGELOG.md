# Changelog

## [Unreleased] - 2025-08-21

### Fixed
- Example list auto-completion no longer incorrectly deletes markers
  - `(@label)|` now correctly continues to next marker instead of deleting
  - `(@)|` treated as valid unlabeled marker, continues instead of deleting  
  - Only `(@|)` with cursor between @ and ) triggers deletion
  - Added comprehensive test coverage in `tests/listAutocompletion.spec.ts`

### Technical Details
- Modified `isEmptyListItem()` in `src/listAutocompletion.ts` to exclude example lists
- Example lists with `(@)` are now recognized as valid unlabeled markers
- Cursor position detection improved for more precise behavior

Commit: b24b7972bad761307273add5f2269c1f3a0b79b9