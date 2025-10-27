/* eslint-disable global-require, @typescript-eslint/no-var-requires, react/react-in-jsx-scope */
import { render } from "@testing-library/react-native";
import { BigNumber } from "bignumber.js";
import { TokenIcon } from "components/TokenIcon";
import { TokenProps } from "components/sds/Token";
import {
  NonNativeToken,
  TokenTypeWithCustomToken,
  Balance,
  LiquidityPoolBalance,
  NativeToken,
} from "config/types";
import { useTokenIconsStore } from "ducks/tokenIcons";

// Mock the token icons store
jest.mock("ducks/tokenIcons", () => ({
  useTokenIconsStore: jest.fn(),
}));

// Mock the logos
jest.mock("assets/logos", () => ({
  logos: {
    stellar: "stellar-logo-url",
  },
}));

// Mock the balances helper
jest.mock("helpers/balances", () => ({
  getTokenIdentifier: (token: NonNativeToken | NativeToken) => {
    if (token.type === "native") return "XLM";
    return `${token.code}:${token.issuer.key}`;
  },
  isLiquidityPool: (balance: Balance) => "liquidityPoolId" in balance,
}));

// Mock react-i18next
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock the Token component
jest.mock("components/sds/Token", () => {
  const React = require("react");
  const { View, Text } = require("react-native");
  return {
    Token: ({ sourceOne, size, variant }: TokenProps) => (
      <View testID="token" data-size={size} data-variant={variant}>
        {sourceOne.image && <Text testID="image-url">{sourceOne.image}</Text>}
        {sourceOne.renderContent && sourceOne.renderContent()}
      </View>
    ),
  };
});

describe("TokenIcon", () => {
  const mockUseTokenIconsStore = useTokenIconsStore as jest.MockedFunction<
    typeof useTokenIconsStore
  >;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTokenIconsStore.mockReturnValue({ icons: {} });
  });

  it("renders Stellar logo for native XLM token", () => {
    const { getByTestId } = render(
      <TokenIcon
        token={{
          type: "native",
          code: "XLM",
        }}
      />,
    );

    const imageUrl = getByTestId("image-url");
    expect(imageUrl.props.children).toBe("stellar-logo-url");
  });

  it("renders token initials when no icon is available", () => {
    const { getByText } = render(
      <TokenIcon
        token={{
          code: "USDC",
          issuer: {
            key: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
          },
          type: TokenTypeWithCustomToken.CREDIT_ALPHANUM12,
        }}
      />,
    );

    expect(getByText("US")).toBeTruthy();
  });

  it("renders LP text for liquidity pool tokens", () => {
    const mockLPBalance = {
      total: new BigNumber("100"),
      liquidityPoolId: "pool-123",
    } as LiquidityPoolBalance;

    const { getByText } = render(<TokenIcon token={mockLPBalance} />);
    expect(getByText("LP")).toBeTruthy();
  });
});
