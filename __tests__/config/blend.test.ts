import {
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
      "CBAKAZUEJBAFA2DCGBRS2WKJT3FNIMJBHTFL76AY7XMAVEINQNNIQWAO",
    );
    expect(getBlendPoolId(details(NETWORKS.TESTNET))).toBe(
      "CB3447A446DY3USGWPIDXTNQHF5EX24XDQA2EN6TAZP62JTPBTNOA52Q",
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

  it("exposes exactly the two allowlisted networks", () => {
    expect(Object.keys(BLEND_FIXED_POOL_IDS).sort()).toEqual(
      [NETWORKS.PUBLIC, NETWORKS.TESTNET].sort(),
    );
  });
});
