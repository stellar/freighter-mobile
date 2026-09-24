import { logos } from "assets/logos";
import { mapSwapHistoryItem } from "components/screens/HistoryScreen/mappers/swap";
import { NETWORKS } from "config/constants";
import { getIconUrl } from "helpers/getIconUrl";
import { ThemeColors } from "hooks/useColors";

jest.mock("helpers/getIconUrl");

const mockGetIconUrl = getIconUrl as jest.MockedFunction<typeof getIconUrl>;

const themeColors = {
  foreground: { primary: "#000000" },
} as unknown as ThemeColors;

const baseArgs = {
  stellarExpertUrl: "https://stellar.expert",
  date: "2026-06-08",
  fee: "100",
  network: NETWORKS.PUBLIC,
  themeColors,
  xdr: "AAAA",
};

const XLM_ISSUER = "GBEO62ZYAOEKVL4WMF5Q6VYTOJQUT7H2QYRDVFO5LT4W7VQPFDWVKUHO";

const buildSwapArgs = (operation: Record<string, unknown>) => ({
  ...baseArgs,
  operation: {
    id: "op-1",
    amount: "100",
    source_amount: "50",
    ...operation,
  },
});

describe("mapSwapHistoryItem - nativeness detection from operation type", () => {
  beforeEach(() => {
    mockGetIconUrl.mockReset();
    mockGetIconUrl.mockResolvedValue("https://icons.example/token.png");
  });

  it("renders the Stellar logo for a genuinely native destination and skips its icon fetch", async () => {
    const result = await mapSwapHistoryItem(
      buildSwapArgs({
        asset_type: "native",
        source_asset_type: "credit_alphanum4",
        source_asset_code: "USDC",
        source_asset_issuer: XLM_ISSUER,
      }),
    );

    const iconComponent = result.IconComponent as React.ReactElement<{
      sourceTwo: { image?: unknown; token?: unknown };
    }>;

    expect(iconComponent.props.sourceTwo.image).toBe(logos.stellar);
    expect(iconComponent.props.sourceTwo.token).toBeUndefined();

    expect(mockGetIconUrl).not.toHaveBeenCalledWith(
      expect.objectContaining({
        asset: expect.objectContaining({ code: "XLM" }),
      }),
    );
  });

  it("renders the token icon for an XLM-coded classic destination instead of the Stellar logo", async () => {
    const result = await mapSwapHistoryItem(
      buildSwapArgs({
        asset_type: "credit_alphanum4",
        asset_code: "XLM",
        asset_issuer: XLM_ISSUER,
        source_asset_type: "credit_alphanum4",
        source_asset_code: "USDC",
        source_asset_issuer: XLM_ISSUER,
      }),
    );

    const iconComponent = result.IconComponent as React.ReactElement<{
      sourceTwo: {
        image?: unknown;
        token?: { code: string; issuer: string };
      };
    }>;

    expect(iconComponent.props.sourceTwo.image).toBeUndefined();
    expect(iconComponent.props.sourceTwo.token).toEqual({
      code: "XLM",
      issuer: XLM_ISSUER,
    });

    expect(mockGetIconUrl).toHaveBeenCalledWith({
      asset: { code: "XLM", issuer: XLM_ISSUER },
      network: NETWORKS.PUBLIC,
    });
  });

  it("renders the Stellar logo for a genuinely native source and skips its icon fetch", async () => {
    const result = await mapSwapHistoryItem(
      buildSwapArgs({
        asset_type: "credit_alphanum4",
        asset_code: "USDC",
        asset_issuer: XLM_ISSUER,
        source_asset_type: "native",
      }),
    );

    const iconComponent = result.IconComponent as React.ReactElement<{
      sourceOne: { image?: unknown; token?: unknown };
    }>;

    expect(iconComponent.props.sourceOne.image).toBe(logos.stellar);
    expect(iconComponent.props.sourceOne.token).toBeUndefined();

    expect(mockGetIconUrl).not.toHaveBeenCalledWith(
      expect.objectContaining({
        asset: expect.objectContaining({ code: "XLM" }),
      }),
    );
  });

  it("renders the token icon for an XLM-coded classic source instead of the Stellar logo", async () => {
    const result = await mapSwapHistoryItem(
      buildSwapArgs({
        asset_type: "credit_alphanum4",
        asset_code: "USDC",
        asset_issuer: XLM_ISSUER,
        source_asset_type: "credit_alphanum4",
        source_asset_code: "XLM",
        source_asset_issuer: XLM_ISSUER,
      }),
    );

    const iconComponent = result.IconComponent as React.ReactElement<{
      sourceOne: {
        image?: unknown;
        token?: { code: string; issuer: string };
      };
    }>;

    expect(iconComponent.props.sourceOne.image).toBeUndefined();
    expect(iconComponent.props.sourceOne.token).toEqual({
      code: "XLM",
      issuer: XLM_ISSUER,
    });

    expect(mockGetIconUrl).toHaveBeenCalledWith({
      asset: { code: "XLM", issuer: XLM_ISSUER },
      network: NETWORKS.PUBLIC,
    });
  });
});
