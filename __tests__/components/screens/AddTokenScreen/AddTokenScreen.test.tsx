/* eslint-disable @fnando/consistent-import/consistent-import */
import { fireEvent } from "@testing-library/react-native";
import AddTokenScreen from "components/screens/AddTokenScreen/AddTokenScreen";
import { recordTokenId } from "components/screens/SwapScreen/helpers";
import { ROOT_NAVIGATOR_ROUTES } from "config/routes";
import { HookStatus, TokenTypeWithCustomToken } from "config/types";
import { renderWithProviders } from "helpers/testUtils";
import { useTokenLookup } from "hooks/useTokenLookup";
import React from "react";

jest.mock("hooks/useTokenLookup", () => ({ useTokenLookup: jest.fn() }));

const mockPriceHistoryEnabled = jest.fn(() => false);
jest.mock("hooks/usePriceHistoryEnabled", () => ({
  __esModule: true,
  default: () => mockPriceHistoryEnabled(),
}));

jest.mock("hooks/useBalancesList", () => ({
  useBalancesList: jest.fn(() => ({
    balanceItems: [],
    hiddenBalanceItems: [],
    handleRefresh: jest.fn(),
  })),
}));

jest.mock("hooks/useGetActiveAccount", () => () => ({
  account: {
    publicKey: "GBDQOFC6SKCNBHPLZ7NXQ6MCKFIYUUFVOWYGNWQCXC2F4AYZ27EUWYWH",
  },
}));

jest.mock("hooks/useRightHeader", () => ({
  useRightHeaderButton: jest.fn(),
}));

jest.mock("hooks/useManageToken", () => ({
  useManageToken: () => ({
    addToken: jest.fn(),
    removeToken: jest.fn(),
    isAddingToken: false,
    isRemovingToken: false,
  }),
}));

jest.mock("ducks/auth", () => ({
  useAuthenticationStore: jest.fn(() => ({ network: "PUBLIC" })),
}));

const mockNavigate = jest.fn();
const navigation = {
  goBack: jest.fn(),
  navigate: mockNavigate,
} as any;

const makeRecord = (tokenCode: string) => ({
  tokenCode,
  issuer: `G${tokenCode}ISSUER`,
  domain: "example.com",
  isNative: false,
  hasTrustline: false,
  tokenType: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
});
const verified = makeRecord("USDC");
const unverified = makeRecord("SCAM");

describe("AddTokenScreen — View details gate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPriceHistoryEnabled.mockReturnValue(false);
    (useTokenLookup as jest.Mock).mockReturnValue({
      searchResults: [verified, unverified],
      verifiedTokens: [verified],
      unverifiedTokens: [unverified],
      hasScanFailed: false,
      status: HookStatus.SUCCESS,
      handleSearch: jest.fn(),
      resetSearch: jest.fn(),
    });
  });

  it.each([verified, unverified])(
    "opens token details with source add_token when price history is enabled ($tokenCode)",
    (record) => {
      mockPriceHistoryEnabled.mockReturnValue(true);
      const { getByTestId } = renderWithProviders(
        <AddTokenScreen navigation={navigation} route={{} as any} />,
      );

      fireEvent.press(getByTestId(`token-item-body-${record.tokenCode}`));

      expect(mockNavigate).toHaveBeenCalledWith(
        ROOT_NAVIGATOR_ROUTES.TOKEN_DETAILS_SCREEN,
        {
          tokenId: recordTokenId(record as any),
          tokenSymbol: record.tokenCode,
          record: expect.objectContaining({ tokenCode: record.tokenCode }),
          source: "add_token",
        },
      );
    },
  );

  describe("Soroban rows", () => {
    const contractId =
      "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75";
    const sorobanRecord = (tokenCode: string) => ({
      tokenCode,
      issuer: contractId,
      domain: "",
      isNative: false,
      hasTrustline: false,
      tokenType: TokenTypeWithCustomToken.CUSTOM_TOKEN,
    });
    const openDetails = (record: ReturnType<typeof sorobanRecord>) => {
      mockPriceHistoryEnabled.mockReturnValue(true);
      (useTokenLookup as jest.Mock).mockReturnValue({
        searchResults: [record],
        verifiedTokens: [record],
        unverifiedTokens: [],
        hasScanFailed: false,
        status: HookStatus.SUCCESS,
        handleSearch: jest.fn(),
        resetSearch: jest.fn(),
      });
      const { getByTestId } = renderWithProviders(
        <AddTokenScreen navigation={navigation} route={{} as any} />,
      );
      fireEvent.press(getByTestId(`token-item-body-${record.tokenCode}`));
    };

    it("opens a code-less token by its contract id", () => {
      openDetails(sorobanRecord(contractId));

      expect(mockNavigate).toHaveBeenCalledWith(
        ROOT_NAVIGATOR_ROUTES.TOKEN_DETAILS_SCREEN,
        expect.objectContaining({ tokenId: contractId }),
      );
    });

    it("opens a held token by its balance id when the record's code differs", () => {
      const { useBalancesList } = jest.requireMock("hooks/useBalancesList");
      useBalancesList.mockReturnValueOnce({
        balanceItems: [
          { id: `TKN:${contractId}`, contractId, tokenCode: "TKN" },
        ],
        hiddenBalanceItems: [],
        handleRefresh: jest.fn(),
      });
      openDetails(sorobanRecord("SEXPCODE"));

      expect(mockNavigate).toHaveBeenCalledWith(
        ROOT_NAVIGATOR_ROUTES.TOKEN_DETAILS_SCREEN,
        expect.objectContaining({
          tokenId: `TKN:${contractId}`,
          tokenSymbol: "TKN",
        }),
      );
    });
  });

  it("renders no pressable body when price history is disabled, and keeps Add", () => {
    const { queryByTestId, getAllByTestId } = renderWithProviders(
      <AddTokenScreen navigation={navigation} route={{} as any} />,
    );

    expect(queryByTestId("token-item-body-USDC")).toBeNull();
    expect(queryByTestId("token-item-body-SCAM")).toBeNull();
    expect(getAllByTestId("add-token-button")).toHaveLength(2);
  });
});
