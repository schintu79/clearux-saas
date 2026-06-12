// Plain-JS jest config — deliberately NOT TypeScript.
// jest.config.ts requires ts-node (or Node ≥22 type stripping) to even be
// parsed; CI runs Node 20 with a clean `npm ci`, where ts-node does not
// exist → jest died before loading a single test (first red CI, 2026-06-12).
// JS config loads identically on every Node version with zero extra deps.

/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }],
  },
}

module.exports = config
