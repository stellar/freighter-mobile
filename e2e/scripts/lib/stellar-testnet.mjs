import StellarHDWallet from "stellar-hd-wallet";
import {
  Asset,
  Horizon,
  Keypair,
  TransactionBuilder,
  Operation,
  Networks,
  BASE_FEE,
} from "@stellar/stellar-sdk";

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

// ── Live testnet I/O helpers (real network calls) ────────────────────────────

const server = new Horizon.Server(HORIZON_URL);

// 10× base fee: cheap on friendbot-funded accounts, but survives testnet fee surges
// that would otherwise fail provisioning with tx_insufficient_fee (a flakiness source).
const PROVISION_FEE = String(10 * Number(BASE_FEE));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Fund a public key via friendbot, with bounded retries for friendbot flakiness. */
export async function fundWithFriendbot(publicKey, { retries = 5 } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${FRIENDBOT_URL}?addr=${encodeURIComponent(publicKey)}`);
      if (res.ok) return;
      lastErr = new Error(`friendbot HTTP ${res.status}`);
    } catch (e) {
      lastErr = e;
    }
    if (attempt < retries) await sleep(attempt * 2000);
  }
  throw new Error(`friendbot failed for ${publicKey} after ${retries} attempts: ${lastErr}`);
}

/** Poll Horizon until the account is visible (friendbot funding settled). */
export async function waitForAccount(publicKey, { retries = 10 } = {}) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await server.loadAccount(publicKey);
    } catch (e) {
      if (attempt === retries) {
        throw new Error(
          `account ${publicKey} not found on testnet after ${retries} polls: ${e?.message ?? e}`,
        );
      }
      await sleep(1500);
    }
  }
}

/** Sign + submit a transaction built from the given source keypair. */
async function submit(builderFn, sourceKeypair) {
  const account = await server.loadAccount(sourceKeypair.publicKey());
  const tx = builderFn(
    new TransactionBuilder(account, {
      fee: PROVISION_FEE,
      networkPassphrase: Networks.TESTNET,
    }),
  )
    .setTimeout(60)
    .build();
  tx.sign(sourceKeypair);
  return server.submitTransaction(tx);
}

/** Create + friendbot-fund a brand-new account; returns its keypair. */
export async function createFundedAccount() {
  const kp = Keypair.random();
  await fundWithFriendbot(kp.publicKey());
  await waitForAccount(kp.publicKey());
  return kp;
}

/** Add a trustline to the pinned testnet USDC asset for the given account. */
export async function addUsdcTrustline(sourceKeypair) {
  await submit(
    (b) => b.addOperation(Operation.changeTrust({ asset: TESTNET_USDC })),
    sourceKeypair,
  );
}

/**
 * Acquire a small USDC balance by swapping XLM via a strict-receive path payment
 * to self. Requires the trustline to already exist. `usdcAmount` is a decimal
 * string (e.g. "0.01").
 */
export async function swapXlmToUsdc(sourceKeypair, usdcAmount) {
  const paths = await server
    .strictReceivePaths([Asset.native()], TESTNET_USDC, usdcAmount)
    .call();
  if (!paths.records.length) {
    throw new Error("no XLM→USDC strict-receive path found on testnet");
  }
  // Cheapest path first; add a generous sendMax (2x) to tolerate price drift.
  const best = paths.records.reduce((a, b) =>
    Number(a.source_amount) <= Number(b.source_amount) ? a : b,
  );
  const sendMax = (Number(best.source_amount) * 2).toFixed(7);
  const path = best.path.map((p) =>
    p.asset_type === "native"
      ? Asset.native()
      : new Asset(p.asset_code, p.asset_issuer),
  );
  await submit(
    (b) =>
      b.addOperation(
        Operation.pathPaymentStrictReceive({
          sendAsset: Asset.native(),
          sendMax,
          destination: sourceKeypair.publicKey(),
          destAsset: TESTNET_USDC,
          destAmount: usdcAmount,
          path,
        }),
      ),
    sourceKeypair,
  );
}
