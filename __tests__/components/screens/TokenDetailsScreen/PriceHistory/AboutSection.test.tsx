import { waitFor } from "@testing-library/react-native";
import AboutSection from "components/screens/TokenDetailsScreen/components/PriceHistory/AboutSection";
import { NETWORKS } from "config/constants";
import { useRemoteConfigStore } from "ducks/remoteConfig";
import { clearIssuerHomeDomainCache } from "helpers/issuerHomeDomain";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";
import { getAccount } from "services/stellar";

// Section refs (§N) below are to the token-price-graphs design doc:
// wallet-eng-monorepo/design-docs/token-price-graphs/token-price-graphs-design.md

jest.mock("services/stellar", () => ({
  getAccount: jest.fn(),
}));

jest.mock("config/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockGetAccount = getAccount as jest.MockedFunction<typeof getAccount>;

const USDC_ISSUER = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
const CONTRACT_ID = "CBIJBDNZNF4X35BJ4FFZWCDBSCKOP5NB4PLG4SNENRMLAPYG4P5FM6VN";

const renderSection = (tokenId: string, network: NETWORKS = NETWORKS.PUBLIC) =>
  renderWithProviders(<AboutSection tokenId={tokenId} network={network} />);

describe("AboutSection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useRemoteConfigStore.setState({
      isInitialized: true,
      use_token_price_history: true,
    });
    clearIssuerHomeDomainCache();
    mockGetAccount.mockResolvedValue(null);
  });

  it("renders Issuer, Type and Domain for a classic asset with a home_domain", async () => {
    mockGetAccount.mockResolvedValue({
      home_domain: "centre.io",
    } as Awaited<ReturnType<typeof getAccount>>);

    const { getByText } = renderSection(`USDC:${USDC_ISSUER}`);

    await waitFor(() => {
      expect(getByText("centre.io")).toBeTruthy();
    });
    expect(getByText("About")).toBeTruthy();
    expect(getByText("Issuer")).toBeTruthy();
    expect(getByText("GA5Z...KZVN")).toBeTruthy();
    expect(getByText("Type")).toBeTruthy();
    expect(getByText("Stellar Classic")).toBeTruthy();
    expect(getByText("Domain")).toBeTruthy();
    expect(mockGetAccount).toHaveBeenCalledWith(USDC_ISSUER, NETWORKS.PUBLIC);
  });

  it("omits the Domain row when the issuer has no home_domain", async () => {
    mockGetAccount.mockResolvedValue({
      home_domain: undefined,
    } as Awaited<ReturnType<typeof getAccount>>);

    const { getByText, queryByText } = renderSection(`USDC:${USDC_ISSUER}`);

    await waitFor(() => {
      expect(getByText("Issuer")).toBeTruthy();
    });
    expect(queryByText("Domain")).toBeNull();
  });

  it("renders contract id + Soroban type for a SEP-41 token, without a Horizon lookup", async () => {
    const { getByText, queryByText } = renderSection(`SOLVBTC:${CONTRACT_ID}`);

    await waitFor(() => {
      expect(getByText("Soroban")).toBeTruthy();
    });
    expect(getByText("Issuer")).toBeTruthy();
    expect(getByText("CBIJ...M6VN")).toBeTruthy();
    // A contract has no Horizon account — no lookup, no Domain row.
    expect(mockGetAccount).not.toHaveBeenCalled();
    expect(queryByText("Domain")).toBeNull();
  });

  it("reuses the cached home_domain instead of refetching on every mount", async () => {
    mockGetAccount.mockResolvedValue({
      home_domain: "centre.io",
    } as Awaited<ReturnType<typeof getAccount>>);

    const first = renderSection(`USDC:${USDC_ISSUER}`);
    await waitFor(() => {
      expect(first.getByText("centre.io")).toBeTruthy();
    });
    first.unmount();

    const second = renderSection(`USDC:${USDC_ISSUER}`);
    await waitFor(() => {
      expect(second.getByText("centre.io")).toBeTruthy();
    });

    expect(mockGetAccount).toHaveBeenCalledTimes(1);
  });

  it("renders nothing off mainnet, and issues no Horizon issuer lookup", () => {
    // The chart and stats sections hide off-mainnet; a lone About card left
    // standing (and firing Horizon getAccount calls) is the drift this
    // shared gate exists to prevent (§7.3).
    const { queryByTestId } = renderSection(
      `USDC:${USDC_ISSUER}`,
      NETWORKS.TESTNET,
    );

    expect(queryByTestId("about-section")).toBeNull();
    expect(mockGetAccount).not.toHaveBeenCalled();
  });

  it("renders nothing when the use_token_price_history kill switch is off", () => {
    useRemoteConfigStore.setState({
      isInitialized: true,
      use_token_price_history: false,
    });

    const { queryByTestId } = renderSection(`USDC:${USDC_ISSUER}`);

    expect(queryByTestId("about-section")).toBeNull();
    expect(mockGetAccount).not.toHaveBeenCalled();
  });

  it("special-cases XLM with the canonical network identity (trending precedent)", async () => {
    const { getByText } = renderSection("native");

    await waitFor(() => {
      expect(getByText("Native")).toBeTruthy();
    });
    expect(getByText("Stellar Network")).toBeTruthy();
    expect(getByText("stellar.org")).toBeTruthy();
    expect(mockGetAccount).not.toHaveBeenCalled();
  });
});
