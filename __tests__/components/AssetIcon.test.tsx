/* eslint-disable global-require, @typescript-eslint/no-var-requires, react/react-in-jsx-scope */
import { render } from "@testing-library/react-native";
import { BigNumber } from "bignumber.js";
import { AssetIcon } from "components/AssetIcon";
import { AssetProps } from "components/sds/Asset";
import {
  AssetToken,
  Balance,
  LiquidityPoolBalance,
  NativeToken,
} from "config/types";
import { useAssetIconsStore } from "ducks/assetIcons";

// Mock the asset icons store
jest.mock("ducks/assetIcons", () => ({
  useAssetIconsStore: jest.fn(),
}));

// Mock the logos
jest.mock("assets/logos", () => ({
  logos: {
    stellar: "stellar-logo-url",
  },
}));

// Mock the balances helper
jest.mock("helpers/balances", () => ({
  getTokenIdentifier: (token: AssetToken | NativeToken) => {
    if (token.type === "native") return "XLM";
    return `${token.code}:${token.issuer.key}`;
  },
  isLiquidityPool: (balance: Balance) => "liquidityPoolId" in balance,
}));

// Mock the Asset component
jest.mock("components/sds/Asset", () => {
  const React = require("react");
  const { View, Text } = require("react-native");
  return {
    Asset: ({ sourceOne, size, variant }: AssetProps) => (
      <View testID="asset" data-size={size} data-variant={variant}>
        {sourceOne.image && <Text testID="image-url">{sourceOne.image}</Text>}
        {sourceOne.renderContent && sourceOne.renderContent()}
      </View>
    ),
  };
});

describe("AssetIcon", () => {
  const mockUseAssetIconsStore = useAssetIconsStore as jest.MockedFunction<
    typeof useAssetIconsStore
  >;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAssetIconsStore.mockReturnValue({ icons: {} });
  });

  it("renders Stellar logo for native XLM token", () => {
    const { getByTestId } = render(
      <AssetIcon
        token={{
          type: "native",
          code: "XLM",
          issuer: { key: "native" },
        }}
      />,
    );

    const imageUrl = getByTestId("image-url");
    expect(imageUrl.props.children).toBe("stellar-logo-url");
  });

  it("renders token initials when no icon is available", () => {
    const { getByText } = render(
      <AssetIcon
        token={{
          code: "USDC",
          issuer: {
            key: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
          },
          type: "credit_alphanum4",
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

    const { getByText } = render(<AssetIcon token={mockLPBalance} />);
    expect(getByText("LP")).toBeTruthy();
  });
});
