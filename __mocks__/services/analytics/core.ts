/**
 * Mock factory for services/analytics/core
 * Use this in your test files like:
 * jest.mock("services/analytics/core", () => mockAnalyticsCoreFactory());
 */
export const mockAnalyticsCoreFactory = () => ({
  getExperimentClient: jest.fn(),
  isInitialized: jest.fn(() => false),
  setAnalyticsEnabled: jest.fn(),
  getAnalyticsEnabled: jest.fn(() => false),
});
