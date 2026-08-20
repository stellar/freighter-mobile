import { useEarnStore } from "ducks/earn";

const POOL_ID = "CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD";
const USDC_SAC = "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75";

beforeEach(() => useEarnStore.getState().resetEarn());

describe("earn duck", () => {
  it("starts with no selection and a zero position", () => {
    const state = useEarnStore.getState();
    expect(state.pool).toBeNull();
    expect(state.selectedAssetId).toBe("");
    expect(state.selectedAssetApy).toBeNull();
    expect(state.currentPositionTokens).toBe("0");
    expect(state.lastSubmitFailed).toBe(false);
  });

  it("captures the asset and its rate together at pick time", () => {
    useEarnStore.getState().selectAsset({
      assetId: USDC_SAC,
      apy: 0.1694,
      code: "USDC",
      decimals: 7,
    });

    const state = useEarnStore.getState();
    expect(state.selectedAssetId).toBe(USDC_SAC);
    expect(state.selectedAssetApy).toBe(0.1694);
    expect(state.selectedAssetCode).toBe("USDC");
    expect(state.selectedAssetDecimals).toBe(7);
  });

  // FIX 1: without this, picking asset A (whose position fetch succeeds),
  // backing out, then picking asset B (whose fetch fails, per
  // `useEarnPosition`'s deliberately non-fatal design) would carry A's
  // position into B's Review "before" value — even without ever leaving
  // the Earn flow, so the navigator-level `resetEarn()` alone would not
  // have caught it.
  it("clears currentPositionTokens on an asset switch, even mid-flow", () => {
    useEarnStore.getState().setCurrentPositionTokens("5000000000");

    useEarnStore.getState().selectAsset({
      assetId: "CANOTHERASSET",
      apy: 0.05,
      code: "XLM",
      decimals: 7,
    });

    expect(useEarnStore.getState().currentPositionTokens).toBe("0");
  });

  it("keeps a null rate null rather than coercing it to zero", () => {
    useEarnStore
      .getState()
      .selectAsset({ assetId: USDC_SAC, apy: null, code: "USDC", decimals: 7 });
    expect(useEarnStore.getState().selectedAssetApy).toBeNull();
  });

  it("records a submit failure so the amount screen can show the retry banner", () => {
    useEarnStore.getState().setSubmitFailed(true);
    expect(useEarnStore.getState().lastSubmitFailed).toBe(true);
  });

  it("clears everything on reset", () => {
    useEarnStore.getState().setPool({ id: POOL_ID } as never);
    useEarnStore
      .getState()
      .selectAsset({ assetId: USDC_SAC, apy: 0.1, code: "USDC", decimals: 7 });
    useEarnStore.getState().setCurrentPositionTokens("5000000000");
    useEarnStore.getState().setSubmitFailed(true);

    useEarnStore.getState().resetEarn();

    const state = useEarnStore.getState();
    expect(state.pool).toBeNull();
    expect(state.selectedAssetId).toBe("");
    expect(state.currentPositionTokens).toBe("0");
    expect(state.lastSubmitFailed).toBe(false);
  });
});
