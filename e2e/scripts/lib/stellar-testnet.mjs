import StellarHDWallet from "stellar-hd-wallet";
import { Asset } from "@stellar/stellar-sdk";

// ── Pinned testnet config (see spec "Verified testnet facts") ────────────────
export const HORIZON_URL = "https://horizon-testnet.stellar.org";
export const FRIENDBOT_URL = "https://friendbot.stellar.org";
export const TESTNET_USDC_CODE = "USDC";
export const TESTNET_USDC_ISSUER =
  "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
export const TESTNET_USDC = new Asset(TESTNET_USDC_CODE, TESTNET_USDC_ISSUER);

// ── Pure helpers ─────────────────────────────────────────────────────────────

/** Generate a fresh 12-word BIP39 mnemonic (matches the app's entropyBits: 128). */
export function generateMnemonic() {
  return StellarHDWallet.generateMnemonic({ entropyBits: 128 });
}

/**
 * Derive a Stellar keypair from a mnemonic using the same library and path the
 * app uses (src/ducks/auth.ts deriveKeyPair → StellarHDWallet.fromMnemonic).
 */
export function deriveKeypairFromMnemonic(mnemonic, index = 0) {
  const wallet = StellarHDWallet.fromMnemonic(mnemonic);
  return {
    publicKey: wallet.getPublicKey(index),
    secret: wallet.getSecret(index),
  };
}

/**
 * Format provisioning results as newline-separated KEY=VALUE lines for the
 * shell runner to `export`. Only includes keys whose value is present.
 */
export function formatProvisionOutput({ mnemonic, recipient, usdcCode, usdcIssuer }) {
  const lines = [];
  if (mnemonic) lines.push(`E2E_TEST_FUNDED_RECOVERY_PHRASE=${mnemonic}`);
  if (recipient) lines.push(`E2E_TEST_RECIPIENT_ADDRESS=${recipient}`);
  if (usdcCode) lines.push(`E2E_TEST_USDC_CODE=${usdcCode}`);
  if (usdcIssuer) lines.push(`E2E_TEST_USDC_ISSUER=${usdcIssuer}`);
  return lines.join("\n");
}
