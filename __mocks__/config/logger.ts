/**
 * Mock factory for config/logger
 * Use this in your test files like:
 * jest.mock("config/logger", () => mockLoggerFactory());
 */
export const mockLoggerFactory = () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
});
