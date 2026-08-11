import { NETWORKS } from "config/constants";
import { getAccountHistoryV2 } from "services/backend";

const PUBLIC_KEY = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H";

const networkDetails = (passphrase: string) =>
  ({
    network: NETWORKS.PUBLIC,
    networkPassphrase: passphrase,
  }) as never;

describe("getAccountHistoryV2", () => {
  it("returns a paginated envelope from fixtures while mocked", async () => {
    const result = await getAccountHistoryV2({
      publicKey: PUBLIC_KEY,
      networkDetails: networkDetails(
        "Public Global Stellar Network ; September 2015",
      ),
    });

    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data.length).toBeGreaterThan(0);
    // Every entry carries the fields the mapper reads.
    expect(result.data[0]).toHaveProperty("hash");
    expect(result.data[0]).toHaveProperty("state_changes");
    expect(result.data[0]).toHaveProperty("operations");
    expect(result.data[0]).toHaveProperty("result_code");
  });

  it("honours the limit parameter", async () => {
    const result = await getAccountHistoryV2({
      publicKey: PUBLIC_KEY,
      networkDetails: networkDetails(
        "Public Global Stellar Network ; September 2015",
      ),
      limit: 2,
    });

    expect(result.data.length).toBeLessThanOrEqual(2);
  });

  it("throws for a passphrase the v2 endpoint does not serve", async () => {
    await expect(
      getAccountHistoryV2({
        publicKey: PUBLIC_KEY,
        networkDetails: networkDetails(
          "Test SDF Future Network ; October 2022",
        ),
      }),
    ).rejects.toThrow(/does not support network passphrase/);
  });
});
