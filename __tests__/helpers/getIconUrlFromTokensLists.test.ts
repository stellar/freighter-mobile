import { NETWORKS } from "config/constants";
import { getIconUrlFromTokensLists } from "helpers/getIconUrlFromTokensLists";
import {
  fetchVerifiedTokens,
  TOKEN_LISTS_API_SERVICES,
} from "services/verified-token-lists";

jest.mock("services/verified-token-lists", () => ({
  fetchVerifiedTokens: jest.fn(),
  TOKEN_LISTS_API_SERVICES: {},
}));

describe("getIconUrlFromTokensLists", () => {
  const mockTokens = [
    { contract: "ABC123", issuer: "issuer1", icon: "icon-url-1" },
    { contract: "DEF456", issuer: "issuer2", icon: "icon-url-2" },
    { contract: "GHI789", issuer: "issuer3" },
  ];

  beforeEach(() => {
    (fetchVerifiedTokens as jest.Mock).mockResolvedValue(mockTokens);
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
    expect(fetchVerifiedTokens).toHaveBeenCalledWith({
      tokenListsApiServices: TOKEN_LISTS_API_SERVICES,
      network: NETWORKS.PUBLIC,
    });
  });

  it("returns the icon when issuer matches", async () => {
    const icon = await getIconUrlFromTokensLists({
      asset: { issuer: "ISSUER2" }, // case-insensitive
      network: NETWORKS.PUBLIC,
    });
    expect(icon).toBe("icon-url-2");
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
