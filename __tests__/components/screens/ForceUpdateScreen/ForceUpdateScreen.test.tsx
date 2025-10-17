import { ForceUpdateScreen } from "components/screens/ForceUpdateScreen/ForceUpdateScreen";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

jest.mock("hooks/useAppTranslation", () => ({
  __esModule: true,
  default: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock("hooks/useAppUpdate", () => ({
  useAppUpdate: () => ({
    openAppStore: jest.fn(),
  }),
}));

jest.mock("components/FreighterLogo", () => ({
  FreighterLogo: () => <div data-testid="freighter-logo" />,
}));

jest.mock("components/sds/Button", () => ({
  Button: ({ children, onPress, variant }: any) => (
    <button type="button" data-testid={`button-${variant}`} onClick={onPress}>
      {children}
    </button>
  ),
}));

describe("ForceUpdateScreen", () => {
  const renderForceUpdateScreen = (
    props: React.ComponentProps<typeof ForceUpdateScreen>,
  ) => renderWithProviders(<ForceUpdateScreen {...props} />);

  const defaultProps = {
    onDismiss: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders correctly with all required text elements", () => {
    const { getByText } = renderForceUpdateScreen(defaultProps);

    expect(getByText("appUpdate.forceUpdate.title")).toBeTruthy();
    expect(getByText("appUpdate.forceUpdate.description")).toBeTruthy();
  });

  it("renders without errors", () => {
    expect(() => renderForceUpdateScreen(defaultProps)).not.toThrow();
  });

  it("renders without onDismiss prop", () => {
    expect(() => renderForceUpdateScreen({})).not.toThrow();
  });
});
