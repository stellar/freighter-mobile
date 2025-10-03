/**
 * Mock factory for helpers/version
 * Use this in your test files like:
 * jest.mock("helpers/version", () => mockVersionFactory());
 */
export const mockVersionFactory = () => ({
  getAppVersion: jest.fn(() => "1.0.0"),
  getBuildNumber: jest.fn(() => "1"),
});
