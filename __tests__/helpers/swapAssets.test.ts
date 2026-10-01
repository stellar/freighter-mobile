/* eslint-disable @fnando/consistent-import/consistent-import */
import { Networks } from "@stellar/stellar-sdk";
import {
  getSorobanContractId,
  swapAssetId,
  swapContractId,
} from "helpers/swapAssets";

import {
  CONTRACT,
  ISSUER,
  USDC_SAC,
  XLM_SAC,
  soroban,
  usdc,
  xlm,
} from "../../__mocks__/swapFixtures";

describe("swap asset helpers", () => {
  it("tells a Soroban token from a classic or native asset", () => {
    expect(getSorobanContractId(soroban(18))).toBe(CONTRACT);
    expect(getSorobanContractId(usdc)).toBeUndefined();
    expect(getSorobanContractId(xlm)).toBeUndefined();
  });

  it("names each asset the way the swap quote route expects", () => {
    expect(swapAssetId(xlm)).toBe("XLM");
    expect(swapAssetId(usdc)).toBe(`USDC:${ISSUER}`);
    expect(swapAssetId(soroban(18))).toBe(CONTRACT);
  });

  it("finds the contract that carries each asset", () => {
    // The Stellar Asset Contracts of XLM and Circle's USDC on pubnet.
    expect(swapContractId(xlm, Networks.PUBLIC)).toBe(XLM_SAC);
    expect(swapContractId(usdc, Networks.PUBLIC)).toBe(USDC_SAC);
    expect(swapContractId(soroban(18), Networks.PUBLIC)).toBe(CONTRACT);
  });
});
