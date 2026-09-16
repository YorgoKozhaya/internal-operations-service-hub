/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  testEnvironment: 'node',
  maxWorkers: 1,
  globalSetup: '<rootDir>/test/global-setup.cjs',
  setupFiles: ['<rootDir>/test/set-env.cjs'],
};
