import { Asset } from "@stellar/stellar-sdk";
import { mapNetworkToNetworkDetails, NETWORKS } from "config/constants";
import { classifyToken } from "helpers/tokenClassification";

const ISSUER = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
const CONTRACT_ID = "CBIJBDNZNF4X35BJ4FFZWCDBSCKOP5NB4PLG4SNENRMLAPYG4P5FM6VN";
/** XLM's own Stellar Asset Contract — a contract id that IS the native asset. */
const NATIVE_SAC = Asset.native().contractId(
  mapNetworkToNetworkDetails(NETWORKS.PUBLIC).networkPassphrase,
);

describe("classifyToken", () => {
  it("classifies both native identifier forms without an address", () => {
    expect(classifyToken("native")).toEqual({ kind: "native", address: null });
    expect(classifyToken("XLM")).toEqual({ kind: "native", address: null });
  });

  it("classifies CODE:ISSUER as classic and returns the issuer", () => {
    expect(classifyToken(`USDC:${ISSUER}`)).toEqual({
      kind: "classic",
      address: ISSUER,
    });
  });

  it("classifies a bare contract ID as soroban", () => {
    expect(classifyToken(CONTRACT_ID)).toEqual({
      kind: "soroban",
      address: CONTRACT_ID,
    });
  });

  it("classifies SYMBOL:CONTRACTID as soroban and returns the contract", () => {
    expect(classifyToken(`SOLVBTC:${CONTRACT_ID}`)).toEqual({
      kind: "soroban",
      address: CONTRACT_ID,
    });
  });

  it("classifies a bare token code as classic with no address", () => {
    expect(classifyToken("USDC")).toEqual({ kind: "classic", address: null });
  });

  it("classifies XLM's own SAC as native when the network is known", () => {
    // Contract id by shape, native asset in fact. Without this the About
    // card reads "Soroban" for XLM and `token_type` reports the same, in a
    // frozen cross-platform dimension.
    expect(classifyToken(NATIVE_SAC, NETWORKS.PUBLIC)).toEqual({
      kind: "native",
      address: null,
    });
  });

  it("still classifies a non-native contract id as soroban with a network", () => {
    expect(classifyToken(CONTRACT_ID, NETWORKS.PUBLIC)).toEqual({
      kind: "soroban",
      address: CONTRACT_ID,
    });
  });

  it("falls back to soroban for the SAC when no network is supplied", () => {
    // Documents the opt-in: callers without network context keep the old
    // behaviour rather than silently guessing a passphrase.
    expect(classifyToken(NATIVE_SAC)).toEqual({
      kind: "soroban",
      address: NATIVE_SAC,
    });
  });
});
