import BigNumber from "bignumber.js";
import { NonHeldTokenHeader } from "components/screens/TokenDetailsScreen/components";
import { NETWORKS } from "config/constants";
import { FormattedSearchTokenRecord } from "config/types";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

const mockFetchPricesForTokenIds = jest.fn();
let mockPrices: Record<string, unknown> = {};

jest.mock("ducks/prices", () => ({
  usePricesStore: (selector: (s: unknown) => unknown) =>
    selector({ fetchPricesForTokenIds: mockFetchPricesForTokenIds }),
  usePricesForNetwork: () => mockPrices,
}));

jest.mock("hooks/useIsReduceMotionEnabled", () => () => false);

jest.mock("hooks/useAppTranslation", () => () => ({ t: (key: string) => key }));

jest.mock("components/TokenIconWithBadge", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  const { View: MockView } = require("react-native");
  const Icon = () => <MockView testID="token-icon" />;
  return { TokenIconWithBadge: Icon, default: Icon };
});

const tokenId = "SHX:GDSTRSHXHGJ7ZIVRBXEYE5Q74XUVCUSEKEBR7UCHEUUEK72N7I7KJ6JH";

const makeRecord = (
  overrides: Partial<FormattedSearchTokenRecord> = {},
): FormattedSearchTokenRecord =>
  ({
    tokenCode: "SHX",
    issuer: "GDSTRSHXHGJ7ZIVRBXEYE5Q74XUVCUSEKEBR7UCHEUUEK72N7I7KJ6JH",
    domain: "stronghold.co",
    isNative: false,
    hasTrustline: false,
    price: 2.1,
    ...overrides,
  }) as FormattedSearchTokenRecord;

const renderHeader = (record = makeRecord()) =>
  renderWithProviders(
    <NonHeldTokenHeader
      tokenId={tokenId}
      network={NETWORKS.PUBLIC}
      record={record}
    />,
  );

describe("NonHeldTokenHeader", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrices = {};
  });

  it("requests the one token's price on mount", () => {
    renderHeader();

    expect(mockFetchPricesForTokenIds).toHaveBeenCalledTimes(1);
    expect(mockFetchPricesForTokenIds).toHaveBeenCalledWith({
      tokens: [tokenId],
      network: NETWORKS.PUBLIC,
    });
  });

  it("renders the token icon", () => {
    const { getByTestId } = renderHeader();
    expect(getByTestId("token-icon")).toBeTruthy();
  });

  it("shows the store price when present", () => {
    mockPrices[tokenId] = {
      currentPrice: new BigNumber("2.5"),
      percentagePriceChange24h: new BigNumber("1.5"),
    };
    const { getByTestId } = renderHeader();

    expect(getByTestId("token-price-header-price")).toHaveTextContent("$2.50");
  });

  it("falls back to the record's spot price, then to --", () => {
    const first = renderHeader();
    expect(first.getByTestId("token-price-header-price")).toHaveTextContent(
      "$2.10",
    );
    first.unmount();

    const second = renderHeader(makeRecord({ price: undefined }));
    expect(second.getByTestId("token-price-header-price")).toHaveTextContent(
      "--",
    );
  });

  it("names the token by record.name, else its code", () => {
    const named = renderHeader(makeRecord({ name: "Stronghold" }));
    expect(named.getByText("Stronghold")).toBeTruthy();
    named.unmount();

    const unnamed = renderHeader();
    expect(unnamed.getByText("SHX")).toBeTruthy();
  });
});
