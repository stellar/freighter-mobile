#!/usr/bin/env node
import { parseArgs } from "node:util";
import {
  TESTNET_USDC_CODE,
  TESTNET_USDC_ISSUER,
  generateMnemonic,
  deriveKeypairFromMnemonic,
  formatProvisionOutput,
  fundWithFriendbot,
  waitForAccount,
  addUsdcTrustline,
  swapXlmToUsdc,
  createFundedAccount,
} from "./lib/stellar-testnet.mjs";
import { Keypair } from "@stellar/stellar-sdk";

// Amount of USDC to acquire when --with-usdc-balance is set. The flows send
// 0.000001 USDC, so this is ample margin and keeps the swap cheap.
const USDC_FUND_AMOUNT = "0.01";

async function main() {
  const { values } = parseArgs({
    options: {
      "with-recipient": { type: "boolean", default: false },
      "with-usdc-trustline": { type: "boolean", default: false },
      "with-usdc-balance": { type: "boolean", default: false },
    },
  });

  // 1. Fresh sender account from a generated mnemonic (so the app can import it).
  const mnemonic = generateMnemonic();
  const { publicKey, secret } = deriveKeypairFromMnemonic(mnemonic);
  const senderKp = Keypair.fromSecret(secret);
  process.stderr.write(`Provisioning sender ${publicKey}...\n`);
  await fundWithFriendbot(publicKey);
  await waitForAccount(publicKey);

  // 2. Optional USDC trustline / balance on the sender.
  if (values["with-usdc-trustline"] || values["with-usdc-balance"]) {
    process.stderr.write("Adding USDC trustline...\n");
    await addUsdcTrustline(senderKp);
  }
  if (values["with-usdc-balance"]) {
    process.stderr.write(`Swapping XLM→USDC (${USDC_FUND_AMOUNT})...\n`);
    await swapXlmToUsdc(senderKp, USDC_FUND_AMOUNT);
  }

  // 3. Optional recipient account (XLM only).
  let recipient;
  if (values["with-recipient"]) {
    process.stderr.write("Creating recipient account...\n");
    const recipientKp = await createFundedAccount();
    recipient = recipientKp.publicKey();
  }

  // 4. Emit KEY=VALUE lines on stdout for the runner to export.
  process.stdout.write(
    formatProvisionOutput({
      mnemonic,
      recipient,
      usdcCode: TESTNET_USDC_CODE,
      usdcIssuer: TESTNET_USDC_ISSUER,
    }) + "\n",
  );
}

main().catch((err) => {
  process.stderr.write(`provision-test-account failed: ${err?.message ?? err}\n`);
  process.exit(1);
});
