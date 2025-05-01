import { RecentContactsList } from "components/screens/SendScreen/components";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

jest.mock("components/screens/SendScreen/components/ContactRow", () => ({
  ContactRow: ({ testID, address }: { testID: string; address: string }) => (
    <button data-testid={testID} type="button">
      Mock Contact Row: {address}
    </button>
  ),
}));

jest.mock("components/sds/Icon", () => ({
  Clock: () => <div data-testid="clock-icon" />,
}));

jest.mock("hooks/useAppTranslation", () => () => ({
  t: () => "Recent",
}));

jest.mock("hooks/useColors", () => ({
  __esModule: true,
  default: () => ({
    themeColors: {
      foreground: {
        primary: "#000000",
      },
    },
  }),
}));

describe("RecentContactsList", () => {
  const mockTransactions = [
    { id: "1", address: "GA7M...63FC" },
    { id: "2", address: "CB2G...KFQR", name: "Test Contact" },
  ];
  const mockOnContactPress = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders recent contacts list", () => {
    const { getByText, getByTestId } = renderWithProviders(
      <RecentContactsList
        transactions={mockTransactions}
        onContactPress={mockOnContactPress}
        testID="recent-contacts"
      />,
    );

    expect(getByTestId("recent-contacts")).toBeTruthy();
    expect(getByText("Recent")).toBeTruthy();
  });

  it("returns null when no contacts are provided", () => {
    const result = renderWithProviders(
      <RecentContactsList
        transactions={[]}
        onContactPress={mockOnContactPress}
      />,
    );

    expect(result.queryByText("Recent")).toBeNull();
  });
});
