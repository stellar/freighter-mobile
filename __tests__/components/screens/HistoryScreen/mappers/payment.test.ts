import { mapPaymentHistoryItem } from "components/screens/HistoryScreen/mappers/payment";
import { ThemeColors } from "hooks/useColors";

// Real, deterministic Stellar addresses.
// MUXED_OF_USER is the muxed (M...) form of USER_BASE — both resolve to the
// same underlying account. OTHER_BASE / OTHER_MUXED belong to a different account.
const USER_BASE = "GCFIRY65OQE7DFP5KLNS2PF2LVZMUZYJX4OZIEQ36N2IQANUB5XVYOJR";
const MUXED_OF_USER =
  "MCFIRY65OQE7DFP5KLNS2PF2LVZMUZYJX4OZIEQ36N2IQANUB5XVYAAAAAAAAAAAPN2X4";
const OTHER_BASE = "GCATS5YOVB6ROX2WUNKGNQ2MP3GMXDMKSG2O4N5CLX3A6W4PZGZZI55U";
const OTHER_MUXED =
  "MCATS5YOVB6ROX2WUNKGNQ2MP3GMXDMKSG2O4N5CLX3A6W4PZGZZIAAAAAAAAAABZCTYA";

const themeColors = {
  foreground: { primary: "#000000" },
} as unknown as ThemeColors;

const baseArgs = {
  publicKey: USER_BASE,
  stellarExpertUrl: "https://stellar.expert",
  date: "2026-06-08",
  fee: "100",
  themeColors,
  xdr: "AAAA",
};

const buildPaymentArgs = (operation: Record<string, unknown>) => ({
  ...baseArgs,
  operation: {
    id: "op-1",
    amount: "100",
    asset_type: "native",
    ...operation,
  },
});

describe("mapPaymentHistoryItem - muxed address recipient detection", () => {
  it("classifies a payment received to the user's muxed address as received", async () => {
    // Horizon resolves the base account in `to` and exposes the muxed form in
    // `to_muxed` when a payment targets a muxed address.
    const result = await mapPaymentHistoryItem(
      buildPaymentArgs({
        to: USER_BASE,
        to_muxed: MUXED_OF_USER,
        from: OTHER_BASE,
      }),
    );

    expect(result.isAddingFunds).toBe(true);
    expect(result.amountText?.startsWith("+")).toBe(true);
  });

  it("classifies a plain payment received to the user's base address as received", async () => {
    const result = await mapPaymentHistoryItem(
      buildPaymentArgs({
        to: USER_BASE,
        from: OTHER_BASE,
      }),
    );

    expect(result.isAddingFunds).toBe(true);
    expect(result.amountText?.startsWith("+")).toBe(true);
  });

  it("classifies a payment sent to another account's muxed address as sent", async () => {
    const result = await mapPaymentHistoryItem(
      buildPaymentArgs({
        to: OTHER_BASE,
        to_muxed: OTHER_MUXED,
        from: USER_BASE,
      }),
    );

    expect(result.isAddingFunds).toBe(false);
    expect(result.amountText?.startsWith("-")).toBe(true);
  });

  it("classifies a plain payment sent to another account as sent", async () => {
    const result = await mapPaymentHistoryItem(
      buildPaymentArgs({
        to: OTHER_BASE,
        from: USER_BASE,
      }),
    );

    expect(result.isAddingFunds).toBe(false);
    expect(result.amountText?.startsWith("-")).toBe(true);
  });
});
