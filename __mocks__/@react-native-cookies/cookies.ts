const CookieManager = {
  get: jest.fn(),
  set: jest.fn(),
  clearAll: jest.fn(),
  clearByName: jest.fn(),
  getAll: jest.fn(),
  flush: jest.fn(),
};

export default CookieManager;
