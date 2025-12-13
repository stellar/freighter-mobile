import { SecurityBlockScreen } from "components/screens/SecurityBlockScreen";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

// Mock hooks
jest.mock("hooks/useAppTranslation", () => ({
  __esModule: true,
  default: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock("hooks/useColors", () => ({
  __esModule: true,
  default: () => ({
    themeColors: {
      red: {
        3: "#FCA5A5",
        6: "#DC2626",
      },
    },
  }),
}));

describe("SecurityBlockScreen", () => {
  const renderSecurityBlockScreen = () =>
    renderWithProviders(<SecurityBlockScreen />);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders without errors", () => {
    expect(() => renderSecurityBlockScreen()).not.toThrow();
  });

  it("renders the security warning title", () => {
    const { getByText } = renderSecurityBlockScreen();
    expect(getByText("jailbreakDetected.title")).toBeTruthy();
  });

  it("renders the security warning description", () => {
    const { getByText } = renderSecurityBlockScreen();
    expect(getByText("jailbreakDetected.description")).toBeTruthy();
  });

  it("renders the security warning disclaimer", () => {
    const { getByText } = renderSecurityBlockScreen();
    expect(getByText("jailbreakDetected.disclaimer")).toBeTruthy();
  });
});
