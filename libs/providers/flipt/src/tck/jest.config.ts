/* eslint-disable */
module.exports = {
  displayName: 'providers-flipt-tck',
  preset: '../../../../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/../../tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  // The TCK is a library in this repository, so it is imported from its source rather than from
  // the published package.
  moduleNameMapper: {
    '@openfeature/tck': ['<rootDir>/../../../../shared/tck/src'],
  },
};
