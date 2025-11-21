import { NETWORKS } from "config/constants";
import { useVerifiedTokensStore } from "ducks/verifiedTokens";
import { getIconUrlFromTokensLists } from "helpers/getIconUrlFromTokensLists";

jest.mock("ducks/verifiedTokens");

describe("getIconUrlFromTokensLists", () => {
  const mockGetVerifiedTokens = jest.fn();
  const mockTokens = [
    { contract: "ABC123", issuer: "issuer1", icon: "icon-url-1" },
    { contract: "DEF456", issuer: "issuer2", icon: "icon-url-2" },
    { contract: "GHI789", issuer: "issuer3" },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (useVerifiedTokensStore.getState as jest.Mock) = jest.fn(() => ({
      getVerifiedTokens: mockGetVerifiedTokens,
    }));
    mockGetVerifiedTokens.mockResolvedValue(mockTokens);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns the icon when contractId matches", async () => {
    const icon = await getIconUrlFromTokensLists({
      asset: { contractId: "abc123" },
      network: NETWORKS.PUBLIC,
    });
    expect(icon).toBe("icon-url-1");
    expect(mockGetVerifiedTokens).toHaveBeenCalledWith({
      network: NETWORKS.PUBLIC,
    });
  });

  it("returns the icon when issuer matches", async () => {
    const icon = await getIconUrlFromTokensLists({
      asset: { issuer: "ISSUER2" }, // case-insensitive
      network: NETWORKS.PUBLIC,
    });
    expect(icon).toBe("icon-url-2");
    expect(mockGetVerifiedTokens).toHaveBeenCalledWith({
      network: NETWORKS.PUBLIC,
    });
  });

  it("returns undefined when no match is found", async () => {
    const icon = await getIconUrlFromTokensLists({
      asset: { contractId: "notfound" },
      network: NETWORKS.PUBLIC,
    });
    expect(icon).toBeUndefined();
  });

  it("returns undefined when token has no icon", async () => {
    const icon = await getIconUrlFromTokensLists({
      asset: { contractId: "GHI789" },
      network: NETWORKS.PUBLIC,
    });
    expect(icon).toBeUndefined();
  });

  it("handles asset with no contractId or issuer gracefully", async () => {
    const icon = await getIconUrlFromTokensLists({
      asset: {},
      network: NETWORKS.PUBLIC,
    });
    expect(icon).toBeUndefined();
  });
});
