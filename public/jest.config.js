module.exports = {
  testEnvironment: 'jsdom',
  testMatch: ['**/tests/**/*.test.js'],
  moduleNameMapper: {
    '\\.css$': '<rootDir>/tests/styleMock.js'
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js']
};
