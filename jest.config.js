module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFiles: ['./jest.setup.js'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      diagnostics: false,
      isolatedModules: true,
    }],
  },
  moduleNameMapper: {
    // Mock native modules that might be imported
    'cactus-react-native': '<rootDir>/src/ai/__tests__/mocks/cactus-react-native.ts',
    '@react-native-async-storage/async-storage': '<rootDir>/src/ai/__tests__/mocks/async-storage.ts',
    'expo-haptics': '<rootDir>/src/ai/__tests__/mocks/empty.ts',
    'expo-speech': '<rootDir>/src/ai/__tests__/mocks/empty.ts',
    'expo-av': '<rootDir>/src/ai/__tests__/mocks/empty.ts',
    'expo-file-system': '<rootDir>/src/ai/__tests__/mocks/empty.ts',
    '@clerk/clerk-expo': '<rootDir>/src/ai/__tests__/mocks/empty.ts',
  },
};
