import { SearchSuggestionsList } from "components/screens/SendScreen/components";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

jest.mock("components/screens/SendScreen/components/ContactRow", () => ({
  ContactRow: ({
    testID,
    address,
    name,
  }: {
    testID: string;
    address: string;
    name?: string;
  }) => (
    <button data-testid={testID} type="button">
      {name || address}
    </button>
  ),
}));

jest.mock("components/sds/Icon", () => ({
  SearchMd: () => <div data-testid="search-icon" />,
}));

jest.mock("hooks/useAppTranslation", () => () => ({
  t: () => "Suggestions",
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

describe("SearchSuggestionsList", () => {
  const mockSuggestions = [
    { id: "1", address: "GA7M...63FC" },
    { id: "2", address: "CB2G...KFQR", name: "Test Contact" },
  ];
  const mockOnContactPress = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders when suggestions are provided", () => {
    const { getByText, getByTestId } = renderWithProviders(
      <SearchSuggestionsList
        suggestions={mockSuggestions}
        onContactPress={mockOnContactPress}
        testID="suggestions-list"
      />,
    );

    expect(getByTestId("suggestions-list")).toBeTruthy();
    expect(getByText("Suggestions")).toBeTruthy();
  });

  it("returns null when no suggestions are provided", () => {
    const result = renderWithProviders(
      <SearchSuggestionsList
        suggestions={[]}
        onContactPress={mockOnContactPress}
      />,
    );

    expect(result.queryByText("Suggestions")).toBeNull();
  });
});
