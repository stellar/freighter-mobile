import { NETWORKS } from "config/constants";
import { freighterBackendV2, getAccountHistoryV2 } from "services/backend";

// Stub the axios-ish instance the same way __tests__/services/backend.test.ts
// does, so getAccountHistoryV2's real request path can be asserted without a
// network call. Until the fixture-serving mock was removed this path was
// unreachable and therefore untested.
jest.mock("services/apiFactory", () => {
  const actual = jest.requireActual("services/apiFactory");
  return {
    ...actual,
    createApiService: jest.fn(() => ({
      get: jest.fn(),
      post: jest.fn(),
      getInstance: jest.fn(() => ({
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
      })),
    })),
    isRequestCanceled: jest.fn(),
  };
});

const PUBLIC_KEY = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H";
const PUBNET_PASSPHRASE = "Public Global Stellar Network ; September 2015";

const networkDetails = (passphrase: string) =>
  ({
    network: NETWORKS.PUBLIC,
    networkPassphrase: passphrase,
  }) as never;

/** The PaginatedResponse envelope, nested under axios' own `data`. */
const envelope = () => ({
  data: {
    data: [
      {
        hash: "abc",
        fee_charged: "100",
        result_code: "TransactionResultCodeTxSuccess",
        ledger_number: 1,
        ledger_created_at: "2026-01-01T00:00:00Z",
        is_fee_bump: false,
        ingested_at: "2026-01-01T00:00:00Z",
        operations: [],
        state_changes: [],
      },
    ],
    pagination: {
      next_cursor: null,
      prev_cursor: null,
      has_next: false,
      has_previous: false,
    },
  },
});

describe("getAccountHistoryV2", () => {
  let mockGet: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGet = freighterBackendV2.get as unknown as jest.Mock;
    mockGet.mockResolvedValue(envelope());
  });

  it("returns the endpoint's paginated envelope", async () => {
    const result = await getAccountHistoryV2({
      publicKey: PUBLIC_KEY,
      networkDetails: networkDetails(PUBNET_PASSPHRASE),
    });

    expect(result.data).toHaveLength(1);
    // The envelope is returned unwrapped — the endpoint puts data/pagination at
    // the top level rather than nesting them under a second `data` the way
    // /protocols and /token-prices do.
    expect(result.data[0]).toHaveProperty("hash", "abc");
    expect(result.pagination).toHaveProperty("has_next", false);
  });

  it("requests the account's transactions with the mapped network name", async () => {
    await getAccountHistoryV2({
      publicKey: PUBLIC_KEY,
      networkDetails: networkDetails(PUBNET_PASSPHRASE),
    });

    const url = mockGet.mock.calls[0][0] as string;
    expect(url).toContain(`/accounts/${PUBLIC_KEY}/transactions`);
    // The wire value is the v2 network name, not the passphrase or the
    // NETWORKS enum value.
    expect(url).toContain("network=PUBLIC");
    // Absent params must not be sent as "undefined".
    expect(url).not.toContain("limit=");
    expect(url).not.toContain("cursor=");
  });

  it("forwards limit and cursor when given", async () => {
    await getAccountHistoryV2({
      publicKey: PUBLIC_KEY,
      networkDetails: networkDetails(PUBNET_PASSPHRASE),
      limit: 2,
      cursor: "273994264668201057",
    });

    const url = mockGet.mock.calls[0][0] as string;
    expect(url).toContain("limit=2");
    expect(url).toContain("cursor=273994264668201057");
  });

  it("throws for a passphrase the v2 endpoint does not serve, without making a request", async () => {
    await expect(
      getAccountHistoryV2({
        publicKey: PUBLIC_KEY,
        networkDetails: networkDetails(
          "Test SDF Future Network ; October 2022",
        ),
      }),
    ).rejects.toThrow(/does not support network passphrase/);

    expect(mockGet).not.toHaveBeenCalled();
  });

  it("throws rather than returning an empty page when the envelope has no data", async () => {
    mockGet.mockResolvedValue({ data: {} });

    // Throwing (rather than resolving empty) is what lets the duck's catch
    // surface a user-visible error instead of an indistinguishable empty
    // history.
    await expect(
      getAccountHistoryV2({
        publicKey: PUBLIC_KEY,
        networkDetails: networkDetails(PUBNET_PASSPHRASE),
      }),
    ).rejects.toBeDefined();
  });
});
