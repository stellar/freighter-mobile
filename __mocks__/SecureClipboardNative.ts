/**
 * Mock for SecureClipboard native module
 */
const SecureClipboardNative = {
  setString: jest.fn().mockResolvedValue(undefined),
  getString: jest.fn().mockResolvedValue(""),
  clearString: jest.fn().mockResolvedValue(undefined),
};

export default SecureClipboardNative;
