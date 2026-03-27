import { renderHook } from "@testing-library/react-hooks";
import { getDeviceLanguage } from "helpers/localeUtils";
import { useMaintenanceMode } from "hooks/useMaintenanceMode";

const mockUseRemoteConfigStore = jest.fn();

jest.mock("ducks/remoteConfig", () => ({
  useRemoteConfigStore: () => mockUseRemoteConfigStore(),
}));

// NoticeBannerVariants is used by the content parsers — mock avoids pulling in RN components
jest.mock("components/sds/NoticeBanner", () => ({
  NoticeBannerVariants: {
    PRIMARY: "primary",
    SECONDARY: "secondary",
    TERTIARY: "tertiary",
    WARNING: "warning",
    ERROR: "error",
  },
}));

// getDeviceLanguage is already globally mocked returning "en" via jest.setup.js
const mockGetDeviceLanguage = getDeviceLanguage as jest.Mock;

const BANNER_PAYLOAD = {
  theme: "warning",
  banner: {
    title: { en: "Some services are down", pt: "Alguns serviços estão fora" },
  },
  modal: {
    title: { en: "Modal title", pt: "Título modal" },
    body: {
      en: ["Paragraph one", "Paragraph two"],
      pt: ["Parágrafo um", "Parágrafo dois"],
    },
  },
};

const SCREEN_PAYLOAD = {
  content: {
    title: { en: "Maintenance in progress", pt: "Manutenção em andamento" },
    body: {
      en: ["We will be back soon", "Thank you for your patience"],
      pt: ["Voltaremos em breve", "Obrigado pela sua paciência"],
    },
  },
};

const DEFAULT_FLAGS = {
  maintenance_banner: { enabled: false, payload: undefined },
  maintenance_screen: { enabled: false, payload: undefined },
};

describe("useMaintenanceMode", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDeviceLanguage.mockReturnValue("en");
    mockUseRemoteConfigStore.mockReturnValue(DEFAULT_FLAGS);
  });

  describe("showMaintenanceBanner", () => {
    it.each([
      {
        description: "flag disabled, no payload",
        flag: { enabled: false, payload: undefined },
        expected: false,
      },
      {
        description: "flag disabled with valid payload",
        flag: { enabled: false, payload: BANNER_PAYLOAD },
        expected: false,
      },
      {
        description: "enabled but payload is undefined",
        flag: { enabled: true, payload: undefined },
        expected: false,
      },
      {
        description: "enabled with payload but no title",
        flag: { enabled: true, payload: { theme: "warning" } },
        expected: false,
      },
      {
        description: "enabled with full payload",
        flag: { enabled: true, payload: BANNER_PAYLOAD },
        expected: true,
      },
    ])("is $expected — $description", ({ flag, expected }) => {
      mockUseRemoteConfigStore.mockReturnValue({
        ...DEFAULT_FLAGS,
        maintenance_banner: flag,
      });

      const { result } = renderHook(() => useMaintenanceMode());

      expect(result.current.showMaintenanceBanner).toBe(expected);
    });
  });

  describe("showMaintenanceScreen", () => {
    it.each([
      {
        description: "flag disabled, no payload",
        flag: { enabled: false, payload: undefined },
        expected: false,
      },
      {
        description: "flag disabled with valid payload",
        flag: { enabled: false, payload: SCREEN_PAYLOAD },
        expected: false,
      },
      {
        description: "enabled but payload is undefined",
        flag: { enabled: true, payload: undefined },
        expected: false,
      },
      {
        description: "enabled with payload but no title",
        flag: { enabled: true, payload: { content: {} } },
        expected: false,
      },
      {
        description: "enabled with full payload",
        flag: { enabled: true, payload: SCREEN_PAYLOAD },
        expected: true,
      },
    ])("is $expected — $description", ({ flag, expected }) => {
      mockUseRemoteConfigStore.mockReturnValue({
        ...DEFAULT_FLAGS,
        maintenance_screen: flag,
      });

      const { result } = renderHook(() => useMaintenanceMode());

      expect(result.current.showMaintenanceScreen).toBe(expected);
    });
  });

  describe("bannerContent", () => {
    describe("locale selection", () => {
      it.each([
        {
          lang: "en",
          expectedTitle: "Some services are down",
          expectedModalTitle: "Modal title",
          expectedModalBody: ["Paragraph one", "Paragraph two"],
        },
        {
          lang: "pt",
          expectedTitle: "Alguns serviços estão fora",
          expectedModalTitle: "Título modal",
          expectedModalBody: ["Parágrafo um", "Parágrafo dois"],
        },
        {
          lang: "fr", // unavailable — falls back to en
          expectedTitle: "Some services are down",
          expectedModalTitle: "Modal title",
          expectedModalBody: ["Paragraph one", "Paragraph two"],
        },
      ])(
        "returns correct title, modal title and body for lang=$lang",
        ({ lang, expectedTitle, expectedModalTitle, expectedModalBody }) => {
          mockGetDeviceLanguage.mockReturnValue(lang);
          mockUseRemoteConfigStore.mockReturnValue({
            ...DEFAULT_FLAGS,
            maintenance_banner: { enabled: true, payload: BANNER_PAYLOAD },
          });

          const { result } = renderHook(() => useMaintenanceMode());

          expect(result.current.bannerContent.title).toBe(expectedTitle);
          expect(result.current.bannerContent.modal?.title).toBe(
            expectedModalTitle,
          );
          expect(result.current.bannerContent.modal?.body).toEqual(
            expectedModalBody,
          );
        },
      );
    });

    describe("theme", () => {
      it.each([
        { input: "primary", expected: "primary" },
        { input: "secondary", expected: "secondary" },
        { input: "tertiary", expected: "tertiary" },
        { input: "warning", expected: "warning" },
        { input: "error", expected: "error" },
        { input: "invalid", expected: "warning" }, // unrecognised — fallback
        { input: undefined, expected: "warning" }, // missing — fallback
      ])("maps theme '$input' → '$expected'", ({ input, expected }) => {
        const { theme: bannerTheme, ...payloadWithoutTheme } = BANNER_PAYLOAD;
        const payload =
          input !== undefined
            ? { ...BANNER_PAYLOAD, theme: input }
            : payloadWithoutTheme;

        mockUseRemoteConfigStore.mockReturnValue({
          ...DEFAULT_FLAGS,
          maintenance_banner: { enabled: true, payload },
        });

        const { result } = renderHook(() => useMaintenanceMode());

        expect(result.current.bannerContent.theme).toBe(expected);
      });
    });

    describe("url", () => {
      it.each([
        {
          description: "valid https url",
          input: "https://status.freighter.app",
          expected: "https://status.freighter.app",
        },
        { description: "empty string", input: "", expected: undefined },
        { description: "non-string (number)", input: 42, expected: undefined },
        { description: "undefined", input: undefined, expected: undefined },
      ])("$description → $expected", ({ input, expected }) => {
        mockUseRemoteConfigStore.mockReturnValue({
          ...DEFAULT_FLAGS,
          maintenance_banner: {
            enabled: true,
            payload: { ...BANNER_PAYLOAD, url: input },
          },
        });

        const { result } = renderHook(() => useMaintenanceMode());

        expect(result.current.bannerContent.url).toBe(expected);
      });
    });

    describe("modal body", () => {
      it.each([
        {
          description: "no modal in payload",
          modal: undefined,
          expectedModal: undefined,
        },
        {
          description: "all string body values",
          modal: {
            title: { en: "Title" },
            body: { en: ["Line one", "Line two"] },
          },
          expectedModal: { title: "Title", body: ["Line one", "Line two"] },
        },
        {
          description: "filters non-string values from body",
          modal: {
            title: { en: "Title" },
            body: { en: ["valid", 42, null, "also valid"] },
          },
          expectedModal: { title: "Title", body: ["valid", "also valid"] },
        },
      ])("$description", ({ modal, expectedModal }) => {
        mockUseRemoteConfigStore.mockReturnValue({
          ...DEFAULT_FLAGS,
          maintenance_banner: {
            enabled: true,
            payload: {
              theme: "warning",
              banner: { title: BANNER_PAYLOAD.banner.title },
              modal,
            },
          },
        });

        const { result } = renderHook(() => useMaintenanceMode());

        expect(result.current.bannerContent.modal).toEqual(expectedModal);
      });
    });
  });

  describe("screenContent", () => {
    describe("locale selection", () => {
      it.each([
        {
          lang: "en",
          expectedTitle: "Maintenance in progress",
          expectedBody: ["We will be back soon", "Thank you for your patience"],
        },
        {
          lang: "pt",
          expectedTitle: "Manutenção em andamento",
          expectedBody: ["Voltaremos em breve", "Obrigado pela sua paciência"],
        },
        {
          lang: "fr", // unavailable — falls back to en
          expectedTitle: "Maintenance in progress",
          expectedBody: ["We will be back soon", "Thank you for your patience"],
        },
      ])(
        "returns correct title and body for lang=$lang",
        ({ lang, expectedTitle, expectedBody }) => {
          mockGetDeviceLanguage.mockReturnValue(lang);
          mockUseRemoteConfigStore.mockReturnValue({
            ...DEFAULT_FLAGS,
            maintenance_screen: { enabled: true, payload: SCREEN_PAYLOAD },
          });

          const { result } = renderHook(() => useMaintenanceMode());

          expect(result.current.screenContent.title).toBe(expectedTitle);
          expect(result.current.screenContent.body).toEqual(expectedBody);
        },
      );
    });

    describe("body parsing", () => {
      it.each([
        {
          description: "all string values",
          body: { en: ["Line one", "Line two"] },
          expectedBody: ["Line one", "Line two"],
        },
        {
          description: "filters non-string values",
          body: { en: ["valid", 99, null, "also valid"] },
          expectedBody: ["valid", "also valid"],
        },
        {
          description: "body is not an array",
          body: { en: "not an array" },
          expectedBody: [],
        },
        {
          description: "body key is missing",
          body: undefined,
          expectedBody: [],
        },
      ])("$description", ({ body, expectedBody }) => {
        mockUseRemoteConfigStore.mockReturnValue({
          ...DEFAULT_FLAGS,
          maintenance_screen: {
            enabled: true,
            payload: { content: { title: { en: "Title" }, body } },
          },
        });

        const { result } = renderHook(() => useMaintenanceMode());

        expect(result.current.screenContent.body).toEqual(expectedBody);
      });
    });
  });

  describe("precedence", () => {
    it("both flags can be independently active — force update takes precedence, then maintenance screen (enforced in RootNavigator)", () => {
      mockUseRemoteConfigStore.mockReturnValue({
        maintenance_banner: { enabled: true, payload: BANNER_PAYLOAD },
        maintenance_screen: { enabled: true, payload: SCREEN_PAYLOAD },
      });

      const { result } = renderHook(() => useMaintenanceMode());

      expect(result.current.showMaintenanceBanner).toBe(true);
      expect(result.current.showMaintenanceScreen).toBe(true);
    });
  });
});
