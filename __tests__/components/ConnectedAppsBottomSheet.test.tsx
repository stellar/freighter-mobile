import { fireEvent, render } from "@testing-library/react-native";
import ConnectedAppsBottomSheet from "components/screens/HomeScreen/ConnectedAppsBottomSheet";
import React from "react";

jest.mock("hooks/useAppTranslation", () => () => ({ t: (k: string) => k }));

jest.mock("hooks/useColors", () => () => ({
  themeColors: {
    foreground: { primary: "#000" },
    text: { secondary: "#666" },
    base: { 1: "#000" },
    gray: { 3: "#eee", 9: "#999" },
    red: { 8: "#f00", 9: "#f00" },
    background: { tertiary: "#f3f3f3" },
  },
}));

jest.mock("components/sds/App", () => ({
  App: ({ appName }: { appName: string }) => appName,
}));

const dapps = [
  { topic: "topic-1", name: "StellarX", favicon: "https://x/icon.png" },
  { topic: "topic-2", name: "Blend", favicon: undefined },
];

describe("ConnectedAppsBottomSheet", () => {
  it("renders a row for each connected dApp", () => {
    const { getByText } = render(
      <ConnectedAppsBottomSheet
        connectedDapps={dapps}
        discoverEnabled
        onDisconnect={jest.fn()}
        onGoToDiscover={jest.fn()}
      />,
    );
    expect(getByText("StellarX")).toBeTruthy();
    expect(getByText("Blend")).toBeTruthy();
  });

  it("calls onDisconnect with the topic when a row's disconnect button is pressed", () => {
    const onDisconnect = jest.fn();
    const { getByTestId } = render(
      <ConnectedAppsBottomSheet
        connectedDapps={dapps}
        discoverEnabled
        onDisconnect={onDisconnect}
        onGoToDiscover={jest.fn()}
      />,
    );
    fireEvent.press(getByTestId("disconnect-topic-1"));
    expect(onDisconnect).toHaveBeenCalledWith("topic-1");
  });

  it("shows the empty state with Go to Discover when discover is enabled", () => {
    const onGoToDiscover = jest.fn();
    const { getByText } = render(
      <ConnectedAppsBottomSheet
        connectedDapps={[]}
        discoverEnabled
        onDisconnect={jest.fn()}
        onGoToDiscover={onGoToDiscover}
      />,
    );
    expect(getByText("connectedApps.noConnectedDappsTitle")).toBeTruthy();
    expect(getByText("connectedApps.noConnectedDappsDescription")).toBeTruthy();
    fireEvent.press(getByText("connectedApps.goToDiscover"));
    expect(onGoToDiscover).toHaveBeenCalled();
  });

  it("shows the no-discover message and no button when discover is disabled", () => {
    const { getByText, queryByText } = render(
      <ConnectedAppsBottomSheet
        connectedDapps={[]}
        discoverEnabled={false}
        onDisconnect={jest.fn()}
        onGoToDiscover={jest.fn()}
      />,
    );
    expect(getByText("connectedApps.noConnectedDappsNoDiscover")).toBeTruthy();
    expect(queryByText("connectedApps.goToDiscover")).toBeNull();
  });
});
