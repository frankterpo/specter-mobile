export const CactusLM = jest.fn().mockImplementation(() => ({
  download: jest.fn().mockResolvedValue(undefined),
  init: jest.fn().mockResolvedValue(undefined),
  complete: jest.fn().mockResolvedValue({
    success: true,
    response: "Mock response",
    totalTimeMs: 100,
    tokensPerSecond: 10,
  }),
  getState: jest.fn().mockReturnValue({ isReady: true }),
}));
export const CactusConfig = { telemetryToken: '' };

