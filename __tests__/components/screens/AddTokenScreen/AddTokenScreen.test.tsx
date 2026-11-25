/* eslint-disable @fnando/consistent-import/consistent-import */
import { fireEvent } from "@testing-library/react-native";
import AddTokenScreen from "components/screens/AddTokenScreen/AddTokenScreen";
import { recordTokenId } from "components/screens/SwapScreen/helpers";
import { useSwapTokenLookup } from "components/screens/SwapScreen/hooks/useSwapTokenLookup";
import { NETWORKS } from "config/constants";
import { ROOT_NAVIGATOR_ROUTES } from "config/routes";
import { HookStatus, TokenTypeWithCustomToken } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { useBalancesStore } from "ducks/balances";
import { renderWithProviders } from "helpers/testUtils";
import { useTokenLookup } from "hooks/useTokenLookup";
import React from "react";
import { Keyboard } from "react-native";
import { SecurityLevel } from "services/blockaid/constants";

// The real sheets' refs are gorhom modals that expose nothing observable, so
// each mocked sheet reports present() under its content component's name.
const mockPresented: string[] = [];
jest.mock("components/BottomSheet", () => ({
  __esModule: true,
  default: ({ modalRef, customContent }: any) => {
    if (modalRef) {
      // eslint-disable-next-line no-param-reassign
      modalRef.current = {
        present: () =>
          mockPresented.push(
            customContent?.type?.displayName ||
              customContent?.type?.name ||
              "unknown",
          ),
        dismiss: jest.fn(),
      };
    }
    return null;
  },
}));

jest.mock("hooks/useTokenLookup", () => ({ useTokenLookup: jest.fn() }));

jest.mock("components/screens/SwapScreen/hooks/useSwapTokenLookup", () => ({
  useSwapTokenLookup: jest.fn(),
}));

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

const mockManageTokenArgs: { token: { code: string } | null }[] = [];
jest.mock("hooks/useManageToken", () => ({
  useManageToken: (args: { token: { code: string } | null }) => {
    mockManageTokenArgs.push(args);
    return {
      addToken: jest.fn(),
      removeToken: jest.fn(),
      isAddingToken: false,
      isRemovingToken: false,
    };
  },
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
const PUBLIC_KEY = "GBDQOFC6SKCNBHPLZ7NXQ6MCKFIYUUFVOWYGNWQCXC2F4AYZ27EUWYWH";
const verified = makeRecord("USDC");
const unverified = makeRecord("SCAM");

beforeEach(() => {
  (useSwapTokenLookup as jest.Mock).mockReturnValue({
    popularTokens: [],
    isTrendingLoading: false,
    stellarExpertDown: false,
  });
});

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

describe("AddTokenScreen — Popular tokens", () => {
  const renderScreen = () =>
    renderWithProviders(
      <AddTokenScreen navigation={navigation} route={{} as any} />,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    mockPriceHistoryEnabled.mockReturnValue(false);
    (useTokenLookup as jest.Mock).mockReturnValue({
      searchResults: [],
      verifiedTokens: [],
      unverifiedTokens: [],
      hasScanFailed: false,
      status: HookStatus.IDLE,
      handleSearch: jest.fn(),
      resetSearch: jest.fn(),
    });
    (useSwapTokenLookup as jest.Mock).mockReturnValue({
      popularTokens: [makeRecord("AQUA"), makeRecord("EURC")],
      isTrendingLoading: false,
      stellarExpertDown: false,
    });
    useBalancesStore.setState({
      fetchedPublicKey: PUBLIC_KEY,
      fetchedNetwork: NETWORKS.PUBLIC,
    });
  });

  it("lists Popular tokens before typing, each with Add", () => {
    const { getByText, getAllByTestId } = renderScreen();

    expect(getByText("Popular tokens")).toBeTruthy();
    expect(getAllByTestId("add-token-button")).toHaveLength(2);
  });

  it("passes sorobanOffMainnet and the account's balances to the lookup", () => {
    renderScreen();

    expect(useSwapTokenLookup).toHaveBeenCalledWith(
      expect.objectContaining({
        sorobanOffMainnet: true,
        network: "PUBLIC",
        balanceItems: [],
        publicKey: "GBDQOFC6SKCNBHPLZ7NXQ6MCKFIYUUFVOWYGNWQCXC2F4AYZ27EUWYWH",
      }),
    );
  });

  it("hides Popular while the field has text and restores it when cleared", () => {
    const { getByTestId, queryByText } = renderScreen();

    fireEvent.changeText(getByTestId("add-token-search-input"), "aq");
    expect(queryByText("Popular tokens")).toBeNull();

    fireEvent.changeText(getByTestId("add-token-search-input"), "");
    expect(queryByText("Popular tokens")).toBeTruthy();
  });

  it("opens token details with source add_token from a popular row when the gate is open", () => {
    mockPriceHistoryEnabled.mockReturnValue(true);
    const { getByTestId } = renderScreen();

    fireEvent.press(getByTestId("token-item-body-AQUA"));

    expect(mockNavigate).toHaveBeenCalledWith(
      ROOT_NAVIGATOR_ROUTES.TOKEN_DETAILS_SCREEN,
      expect.objectContaining({ tokenSymbol: "AQUA", source: "add_token" }),
    );
  });

  it("renders no pressable body on a popular row when the gate is closed", () => {
    const { queryByTestId } = renderScreen();

    expect(queryByTestId("token-item-body-AQUA")).toBeNull();
  });

  it("shows a spinner while Popular loads and no empty state", () => {
    (useSwapTokenLookup as jest.Mock).mockReturnValue({
      popularTokens: [],
      isTrendingLoading: true,
      stellarExpertDown: false,
    });
    const { getByTestId, queryByText } = renderScreen();

    expect(getByTestId("add-token-popular-spinner")).toBeTruthy();
    expect(queryByText("No tokens found")).toBeNull();
  });

  it("shows nothing below the field when the list is empty", () => {
    (useSwapTokenLookup as jest.Mock).mockReturnValue({
      popularTokens: [],
      isTrendingLoading: false,
      stellarExpertDown: false,
    });
    const { queryByText, queryByTestId } = renderScreen();

    expect(queryByText("Popular tokens")).toBeNull();
    expect(queryByTestId("add-token-popular-spinner")).toBeNull();
  });

  it("hides a non-empty Popular list when stellar.expert is down", () => {
    (useSwapTokenLookup as jest.Mock).mockReturnValue({
      popularTokens: [makeRecord("AQUA")],
      isTrendingLoading: false,
      stellarExpertDown: true,
    });
    const { queryByText } = renderScreen();

    expect(queryByText("Popular tokens")).toBeNull();
  });

  it.each([HookStatus.SUCCESS, HookStatus.LOADING])(
    "hides Popular once a search is in flight or done, even with an empty field (%s)",
    (status) => {
      (useTokenLookup as jest.Mock).mockReturnValue({
        searchResults: [],
        verifiedTokens: [],
        unverifiedTokens: [],
        hasScanFailed: false,
        status,
        handleSearch: jest.fn(),
        resetSearch: jest.fn(),
      });
      const { queryByText } = renderScreen();

      expect(queryByText("Popular tokens")).toBeNull();
    },
  );

  it("offers Add, not the manage menu, for a Popular record with a stale hasTrustline", () => {
    (useSwapTokenLookup as jest.Mock).mockReturnValue({
      popularTokens: [{ ...makeRecord("AQUA"), hasTrustline: true }],
      isTrendingLoading: false,
      stellarExpertDown: false,
    });
    const { getAllByTestId } = renderScreen();

    expect(getAllByTestId("add-token-button")).toHaveLength(1);
  });

  it("adds a code-less Soroban Popular token under its full contract id", () => {
    const contractId =
      "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75";
    (useSwapTokenLookup as jest.Mock).mockReturnValue({
      popularTokens: [
        {
          // formatSearchRecord shortens a code-less contract id for display.
          tokenCode: "CCW6...MI75",
          issuer: contractId,
          domain: "",
          isNative: false,
          hasTrustline: false,
          tokenType: TokenTypeWithCustomToken.CUSTOM_TOKEN,
        },
      ],
      isTrendingLoading: false,
      stellarExpertDown: false,
    });
    mockManageTokenArgs.length = 0;
    const { getByTestId } = renderScreen();

    fireEvent.press(getByTestId("add-token-button"));

    expect(mockManageTokenArgs.at(-1)?.token?.code).toBe(contractId);
  });

  it("lists no native XLM row in Popular", () => {
    (useSwapTokenLookup as jest.Mock).mockReturnValue({
      popularTokens: [
        { ...makeRecord("XLM"), issuer: "", isNative: true },
        makeRecord("AQUA"),
      ],
      isTrendingLoading: false,
      stellarExpertDown: false,
    });
    const { getAllByTestId } = renderScreen();

    expect(getAllByTestId("add-token-button")).toHaveLength(1);
  });

  it("shows no Popular header when XLM is its only token", () => {
    (useSwapTokenLookup as jest.Mock).mockReturnValue({
      popularTokens: [{ ...makeRecord("XLM"), issuer: "", isNative: true }],
      isTrendingLoading: false,
      stellarExpertDown: false,
    });
    const { queryByText } = renderScreen();

    expect(queryByText("Popular tokens")).toBeNull();
  });

  it("shows no Popular until balances have loaded once", () => {
    const { useBalancesList } = jest.requireMock("hooks/useBalancesList");
    const loaded = useBalancesList.getMockImplementation();
    useBalancesList.mockImplementation(() => ({
      balanceItems: [],
      hiddenBalanceItems: [],
      handleRefresh: jest.fn(),
      isLoading: true,
      noBalances: true,
    }));
    useBalancesStore.setState({ fetchedPublicKey: null, fetchedNetwork: null });
    try {
      const { queryByText } = renderScreen();

      expect(queryByText("Popular tokens")).toBeNull();
    } finally {
      useBalancesList.mockImplementation(loaded);
    }
  });

  it("shows no Popular while loading over another network's balances", () => {
    const { useBalancesList } = jest.requireMock("hooks/useBalancesList");
    const loaded = useBalancesList.getMockImplementation();
    useBalancesList.mockImplementation(() => ({
      balanceItems: [{ id: "AQUA:GAQUAISSUER", tokenCode: "AQUA" }],
      hiddenBalanceItems: [],
      handleRefresh: jest.fn(),
      isLoading: true,
      noBalances: false,
    }));
    useBalancesStore.setState({
      fetchedPublicKey: PUBLIC_KEY,
      fetchedNetwork: NETWORKS.TESTNET,
    });
    try {
      const { queryByText } = renderScreen();

      expect(queryByText("Popular tokens")).toBeNull();
    } finally {
      useBalancesList.mockImplementation(loaded);
    }
  });

  describe("security verdict on Add", () => {
    const unscanned = {
      ...makeRecord("AQUA"),
      isUnableToScan: true,
      securityLevel: SecurityLevel.UNABLE_TO_SCAN,
    };

    const pressAdd = (network: NETWORKS) => {
      (useAuthenticationStore as unknown as jest.Mock).mockReturnValue({
        network,
      });
      useBalancesStore.setState({ fetchedNetwork: network });
      (useSwapTokenLookup as jest.Mock).mockReturnValue({
        popularTokens: [unscanned],
        isTrendingLoading: false,
        stellarExpertDown: false,
      });
      mockPresented.length = 0;
      const { getByTestId } = renderScreen();

      fireEvent.press(getByTestId("add-token-button"));
    };

    afterEach(() => {
      (useAuthenticationStore as unknown as jest.Mock).mockReturnValue({
        network: "PUBLIC",
      });
    });

    it("goes straight to the add sheet off mainnet", () => {
      pressAdd(NETWORKS.TESTNET);

      expect(mockPresented).toEqual(["AddTokenBottomSheetContent"]);
    });

    it("still presents the security sheet on mainnet", () => {
      pressAdd(NETWORKS.PUBLIC);

      expect(mockPresented).toEqual(["SecurityDetailBottomSheet"]);
    });
  });
});

describe("AddTokenScreen — row taps dismiss the keyboard", () => {
  const dismiss = jest.spyOn(Keyboard, "dismiss");
  const held = { ...makeRecord("USDC"), hasTrustline: true };

  const rowProps = () => {
    const screen = renderWithProviders(
      <AddTokenScreen navigation={navigation} route={{} as any} />,
    );
    const row = screen.UNSAFE_root.findAll(
      (n) =>
        n.props.token?.tokenCode === "USDC" &&
        typeof n.props.handleUnhideToken === "function",
    )[0];
    return { screen, row };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPriceHistoryEnabled.mockReturnValue(true);
    (useTokenLookup as jest.Mock).mockReturnValue({
      searchResults: [held, unverified],
      verifiedTokens: [held],
      unverifiedTokens: [unverified],
      hasScanFailed: false,
      status: HookStatus.SUCCESS,
      handleSearch: jest.fn(),
      resetSearch: jest.fn(),
    });
  });

  afterAll(() => {
    dismiss.mockRestore();
  });

  it("on Add", () => {
    const { getByTestId } = renderWithProviders(
      <AddTokenScreen navigation={navigation} route={{} as any} />,
    );

    fireEvent.press(getByTestId("add-token-button"));

    expect(dismiss).toHaveBeenCalled();
  });

  it("on opening details", () => {
    const { getByTestId } = renderWithProviders(
      <AddTokenScreen navigation={navigation} route={{} as any} />,
    );

    fireEvent.press(getByTestId("token-item-body-SCAM"));

    expect(mockNavigate).toHaveBeenCalled();
    expect(dismiss).toHaveBeenCalled();
  });

  it("on Remove", () => {
    const { row } = rowProps();

    row.props.handleRemoveToken(held);

    expect(dismiss).toHaveBeenCalled();
  });

  it("on Unhide", () => {
    const { row } = rowProps();

    row.props.handleUnhideToken(held);

    expect(dismiss).toHaveBeenCalled();
  });
});
