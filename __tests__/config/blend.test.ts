import {
  BLEND_DEPOSIT_XLM_FEE_BUFFER,
  BLEND_FIXED_POOL_IDS,
  getBlendPoolId,
  isEarnSupportedNetwork,
} from "config/blend";
import { NETWORKS } from "config/constants";

const details = (network: NETWORKS) =>
  ({ network }) as unknown as Parameters<typeof getBlendPoolId>[0];

describe("blend config", () => {
  it("maps PUBLIC and TESTNET to their Fixed pool ids", () => {
    expect(getBlendPoolId(details(NETWORKS.PUBLIC))).toBe(
      "CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD",
    );
    expect(getBlendPoolId(details(NETWORKS.TESTNET))).toBe(
      "CCEBVDYM32YNYCVNRXQKDFFPISJJCV557CDZEIRBEE4NCV4KHPQ44HGF",
    );
  });

  it("reports Earn unsupported for a network with no allowlisted pool", () => {
    expect(getBlendPoolId(details(NETWORKS.FUTURENET))).toBeUndefined();
    expect(isEarnSupportedNetwork(details(NETWORKS.FUTURENET))).toBe(false);
  });

  it("reports Earn supported wherever a pool is allowlisted", () => {
    expect(isEarnSupportedNetwork(details(NETWORKS.PUBLIC))).toBe(true);
    expect(isEarnSupportedNetwork(details(NETWORKS.TESTNET))).toBe(true);
  });

  it("holds back a fee buffer large enough for a Blend submit resource fee", () => {
    // One submit measured at ~546,395 stroops (0.0546 XLM) against the live
    // mainnet pool. The buffer must comfortably exceed that.
    expect(Number(BLEND_DEPOSIT_XLM_FEE_BUFFER)).toBeGreaterThan(0.0546);
  });

  it("exposes exactly the two allowlisted networks", () => {
    expect(Object.keys(BLEND_FIXED_POOL_IDS).sort()).toEqual(
      [NETWORKS.PUBLIC, NETWORKS.TESTNET].sort(),
    );
  });
});
