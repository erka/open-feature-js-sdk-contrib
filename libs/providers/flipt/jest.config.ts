/* eslint-disable */
module.exports = {
  displayName: 'providers-flipt',
  preset: '../../../jest.preset.js',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  // The conformance suite needs a container and a seeded backend, so it runs under its own target
  // (`nx run providers-flipt:tck`) rather than with the unit tests.
  testPathIgnorePatterns: ['/tck/'],
  coverageDirectory: '../../../coverage/libs/providers/flipt',
};
