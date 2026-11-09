import { NETWORKS } from "config/constants";
import {
  clearIssuerHomeDomainCache,
  getIssuerHomeDomain,
} from "helpers/issuerHomeDomain";
import { getAccount } from "services/stellar";

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

const ISSUER = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";

describe("getIssuerHomeDomain", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearIssuerHomeDomainCache();
  });

  it("fetches once and serves the cached domain afterwards", async () => {
    mockGetAccount.mockResolvedValue({ home_domain: "centre.io" } as Awaited<
      ReturnType<typeof getAccount>
    >);

    await expect(getIssuerHomeDomain(ISSUER, NETWORKS.PUBLIC)).resolves.toBe(
      "centre.io",
    );
    await expect(getIssuerHomeDomain(ISSUER, NETWORKS.PUBLIC)).resolves.toBe(
      "centre.io",
    );

    expect(mockGetAccount).toHaveBeenCalledTimes(1);
  });

  it("caches an account with no home_domain (a real answer, not a failure)", async () => {
    mockGetAccount.mockResolvedValue({ home_domain: undefined } as Awaited<
      ReturnType<typeof getAccount>
    >);

    await getIssuerHomeDomain(ISSUER, NETWORKS.PUBLIC);
    await expect(getIssuerHomeDomain(ISSUER, NETWORKS.PUBLIC)).resolves.toBe(
      null,
    );

    expect(mockGetAccount).toHaveBeenCalledTimes(1);
  });

  it("coalesces concurrent lookups into one request", async () => {
    mockGetAccount.mockResolvedValue({ home_domain: "centre.io" } as Awaited<
      ReturnType<typeof getAccount>
    >);

    await Promise.all([
      getIssuerHomeDomain(ISSUER, NETWORKS.PUBLIC),
      getIssuerHomeDomain(ISSUER, NETWORKS.PUBLIC),
    ]);

    expect(mockGetAccount).toHaveBeenCalledTimes(1);
  });

  it("does not cache a failed lookup — a transient error must not stick", async () => {
    // `getAccount` swallows Horizon failures and RESOLVES null, so this is
    // what a real outage looks like here — never a rejection.
    mockGetAccount.mockResolvedValueOnce(null as never);
    mockGetAccount.mockResolvedValue({ home_domain: "centre.io" } as Awaited<
      ReturnType<typeof getAccount>
    >);

    await expect(getIssuerHomeDomain(ISSUER, NETWORKS.PUBLIC)).resolves.toBe(
      null,
    );
    await expect(getIssuerHomeDomain(ISSUER, NETWORKS.PUBLIC)).resolves.toBe(
      "centre.io",
    );
  });

  it("keys the cache by network", async () => {
    mockGetAccount.mockResolvedValue({ home_domain: "centre.io" } as Awaited<
      ReturnType<typeof getAccount>
    >);

    await getIssuerHomeDomain(ISSUER, NETWORKS.PUBLIC);
    await getIssuerHomeDomain(ISSUER, NETWORKS.TESTNET);

    expect(mockGetAccount).toHaveBeenCalledTimes(2);
  });
});
