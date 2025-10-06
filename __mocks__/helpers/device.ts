/**
 * Mock factory for helpers/device
 * Use this in your test files like:
 * jest.mock("helpers/device", () => mockDeviceFactory());
 */
export const mockDeviceFactory = () => ({
  isAndroid: false,
  isIOS: true,
});
