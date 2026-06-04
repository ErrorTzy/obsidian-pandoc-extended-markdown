module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '^.*__mocks__/obsidian$': '<rootDir>/__mocks__/obsidian.ts',
    '^.*obsidian-extended$': '<rootDir>/__mocks__/obsidian.ts',
    '^obsidian$': '<rootDir>/__mocks__/obsidian.ts',
    '\\.lua$': '<rootDir>/__mocks__/luaFilter.ts',
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
