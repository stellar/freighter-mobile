import { Asset as SdkToken, Networks } from "@stellar/stellar-sdk";
import { resolveSorobanDisplayIdentity } from "components/screens/HistoryScreen/mappers/soroban";

const NATIVE_SAC_TESTNET =
  "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
const OTHER_CONTRACT =
  "CB64D3G7SM2RTH6JSGG34DDTFTQ5CFDKVDZJZSODMCX4NJ2HV2KN7OHT";
const CIRCLE_ISSUER =
  "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";

describe("resolveSorobanDisplayIdentity", () => {
  const passphrase = Networks.TESTNET;

  it("treats symbol 'native' as XLM only for the native contract", () => {
    const spoofed = resolveSorobanDisplayIdentity(
      { symbol: "native", name: "native", contractId: OTHER_CONTRACT },
      passphrase,
    );
    expect(spoofed.isNative).toBe(false);
    expect(spoofed.code).toBe("native");

    const genuine = resolveSorobanDisplayIdentity(
      { symbol: "native", name: "native", contractId: NATIVE_SAC_TESTNET },
      passphrase,
    );
    expect(genuine.isNative).toBe(true);
    expect(genuine.code).toBe("XLM");
  });

  it("accepts a CODE:ISSUER name as a SAC only when the contract id derives from that pair", () => {
    const claimed = `USDC:${CIRCLE_ISSUER}`;
    const unverifiedClaim = resolveSorobanDisplayIdentity(
      { symbol: "USDC", name: claimed, contractId: OTHER_CONTRACT },
      passphrase,
    );
    // Not verified as a SAC: displayed as a plain contract token, issuer NOT
    // taken from the self-reported name.
    expect(unverifiedClaim.isVerifiedSac).toBe(false);
    expect(unverifiedClaim.issuerKey).toBe(OTHER_CONTRACT);

    const realSacId = new SdkToken("USDC", CIRCLE_ISSUER).contractId(
      passphrase,
    );
    const genuine = resolveSorobanDisplayIdentity(
      { symbol: "USDC", name: claimed, contractId: realSacId },
      passphrase,
    );
    expect(genuine.isVerifiedSac).toBe(true);
    expect(genuine.issuerKey).toBe(CIRCLE_ISSUER);
  });
});
