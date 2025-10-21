// Mock the dependencies
const mockT = jest.fn((key: string) => key);
const mockGetDeviceLanguage = jest.fn(() => "en");

jest.doMock("i18next", () => ({
  t: mockT,
}));

jest.doMock("helpers/localeUtils", () => ({
  getDeviceLanguage: mockGetDeviceLanguage,
}));

// Import after mocking
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { appUpdateBannerText } = require("helpers/appUpdateBannerText");

describe("appUpdateBannerText", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockT.mockImplementation((key: string) => key);
    mockGetDeviceLanguage.mockImplementation(() => "en");
  });

  it("should return localized text for current language", () => {
    const appUpdateText = {
      enabled: true,
      payload: {
        en: "Update available in English",
        pt: "Atualização disponível em Português",
      },
    };

    const result = appUpdateBannerText(appUpdateText);

    expect(result).toBe("Update available in English");
  });

  it("should fallback to English when current language is not available", () => {
    mockGetDeviceLanguage.mockReturnValue("fr");

    const appUpdateText = {
      enabled: true,
      payload: {
        en: "Update available in English",
        pt: "Atualização disponível em Português",
      },
    };

    const result = appUpdateBannerText(appUpdateText);

    expect(result).toBe("Update available in English");
  });

  it("should handle Portuguese language correctly", () => {
    mockGetDeviceLanguage.mockReturnValue("pt");

    const appUpdateText = {
      enabled: true,
      payload: {
        en: "Update available in English",
        pt: "Atualização disponível em Português",
      },
    };

    const result = appUpdateBannerText(appUpdateText);

    expect(result).toBe("Atualização disponível em Português");
  });

  it("should return default message when not enabled", () => {
    const appUpdateText = {
      enabled: false,
      payload: {
        en: "Update available",
        pt: "Atualização disponível",
      },
    };

    const result = appUpdateBannerText(appUpdateText);

    expect(mockT).toHaveBeenCalledWith("appUpdate.defaultMessage");
    expect(result).toBe("appUpdate.defaultMessage");
  });

  it("should return default message when payload is null", () => {
    const appUpdateText = {
      enabled: true,
      payload: null,
    };

    const result = appUpdateBannerText(appUpdateText as any);

    expect(mockT).toHaveBeenCalledWith("appUpdate.defaultMessage");
    expect(result).toBe("appUpdate.defaultMessage");
  });

  it("should return default message when payload is undefined", () => {
    const appUpdateText = {
      enabled: true,
      payload: undefined,
    };

    const result = appUpdateBannerText(appUpdateText);

    expect(mockT).toHaveBeenCalledWith("appUpdate.defaultMessage");
    expect(result).toBe("appUpdate.defaultMessage");
  });

  it("should fallback to translation when neither current language nor English is available", () => {
    mockGetDeviceLanguage.mockReturnValue("fr");

    const appUpdateText = {
      enabled: true,
      payload: {
        pt: "Atualização disponível em Português",
      },
    };

    const result = appUpdateBannerText(appUpdateText);

    expect(mockT).toHaveBeenCalledWith("appUpdate.defaultMessage");
    expect(result).toBe("appUpdate.defaultMessage");
  });

  it("should return default message when payload is not an object", () => {
    const appUpdateText = {
      enabled: true,
      payload: "simple string" as any,
    };

    const result = appUpdateBannerText(appUpdateText);

    expect(mockT).toHaveBeenCalledWith("appUpdate.defaultMessage");
    expect(result).toBe("appUpdate.defaultMessage");
  });

  it("should return default message when payload is empty object", () => {
    const appUpdateText = {
      enabled: true,
      payload: {},
    };

    const result = appUpdateBannerText(appUpdateText);

    expect(mockT).toHaveBeenCalledWith("appUpdate.defaultMessage");
    expect(result).toBe("appUpdate.defaultMessage");
  });
});
