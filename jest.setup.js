jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('cactus-react-native', () => ({
  CactusLM: jest.fn().mockImplementation(() => ({
    download: jest.fn().mockResolvedValue(undefined),
    init: jest.fn().mockResolvedValue(undefined),
    complete: jest.fn().mockResolvedValue({
      success: true,
      response: "This is a mock AI response.\n\n**SUMMARY**\n- Strong founder\n- Good exit",
      totalTimeMs: 100,
      tokensPerSecond: 10,
    }),
    getState: jest.fn().mockReturnValue({ isReady: true }),
  })),
  CactusConfig: { telemetryToken: '' },
}));

jest.mock('expo-file-system', () => ({
  documentDirectory: '/tmp/',
  writeAsStringAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
}));

jest.mock('expo-speech', () => ({
  speak: jest.fn(),
}));

jest.mock('expo-av', () => ({
  Audio: {
    Recording: {
      createAsync: jest.fn().mockResolvedValue({
        recording: {
          stopAndUnloadAsync: jest.fn(),
          getURI: jest.fn().mockReturnValue('file://audio.m4a'),
        },
      }),
    },
    setAudioModeAsync: jest.fn(),
  },
}));

