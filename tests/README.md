# Test Structure

This directory contains all tests for the Pandoc Extended Markdown plugin.

## Directory Organization

```
tests/
├── unit/                  # Unit tests for individual components
│   ├── parsers/          # Parser unit tests
│   ├── processors/       # Processor unit tests
│   │   ├── inline/       # Inline processor tests
│   │   └── structural/   # Structural processor tests
│   ├── utils/           # Utility function tests
│   └── features/        # Feature-specific unit tests
├── integration/          # Integration tests
│   ├── pipeline/        # Pipeline integration tests
│   └── features/        # Feature integration tests
└── e2e/                 # End-to-end tests (WDIO)
    ├── specs/          # E2E test specifications
    └── vaults/         # Test vaults for E2E testing
```

## Test Types

### Unit Tests (`/unit/`)
- Test individual functions, classes, and modules in isolation
- Use mocked dependencies
- Fast execution
- Located close to their logical grouping

### Integration Tests (`/integration/`)
- Test interactions between multiple components
- Test complete features with minimal mocking
- Medium execution time

### E2E Tests (`/e2e/`)
- Test the plugin in a real Obsidian environment
- Use WebdriverIO (WDIO) for browser automation
- Slowest execution but most comprehensive
- Test user interactions and UI behavior

## Running Tests

```bash
# Run all tests
npm test

# Run unit tests only
npm test -- tests/unit

# Run integration tests only
npm test -- tests/integration

# Run E2E tests
npm run test:e2e

# Run specific test file
npm test -- tests/unit/parsers/definitionListParser.spec.ts

# Run with coverage
npm run test:coverage
```

## Test Naming Convention

- Test files should end with `.spec.ts`
- Test names should be descriptive and follow the pattern: `<ComponentName>.spec.ts`
- E2E tests should end with `.e2e.ts`

## Writing New Tests

1. **Unit Tests**: Place in the appropriate subdirectory under `/unit/`
2. **Integration Tests**: Place in `/integration/pipeline/` or `/integration/features/`
3. **E2E Tests**: Place in `/e2e/specs/`

Follow existing patterns and use the appropriate mocks from `__mocks__/` directory.