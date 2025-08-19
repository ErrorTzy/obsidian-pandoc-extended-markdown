module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    'obsidian': '<rootDir>/__mocks__/obsidian.ts',
    '@codemirror/state': '<rootDir>/__mocks__/codemirror.ts',
    '@codemirror/view': '<rootDir>/__mocks__/codemirror.ts',
    '@codemirror/language': '<rootDir>/__mocks__/codemirror.ts'
  },
  testMatch: ['**/*.spec.ts', '**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
  ]
};