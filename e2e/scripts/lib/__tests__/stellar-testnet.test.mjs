import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  TESTNET_USDC_CODE,
  TESTNET_USDC_ISSUER,
  TESTNET_USDC,
  generateMnemonic,
  deriveKeypairFromMnemonic,
  formatProvisionOutput,
} from "../stellar-testnet.mjs";

describe("pinned constants", () => {
  it("pins the canonical SDF testnet USDC asset", () => {
    assert.equal(TESTNET_USDC_CODE, "USDC");
    assert.equal(
      TESTNET_USDC_ISSUER,
      "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
    );
  });

  it("constructs the TESTNET_USDC asset with the right code and issuer", () => {
    assert.equal(TESTNET_USDC.getCode(), TESTNET_USDC_CODE);
    assert.equal(TESTNET_USDC.getIssuer(), TESTNET_USDC_ISSUER);
  });
});

describe("deriveKeypairFromMnemonic", () => {
  it("matches the SEP-5 test vector (same derivation as the app)", () => {
    // SEP-0005 test vector 1, account 0. Confirms our derivation matches
    // stellar-hd-wallet as used in src/ducks/auth.ts (deriveKeyPair).
    const mnemonic =
      "illness spike retreat truth genius clock brain pass fit cave bargain toe";
    const { publicKey, secret } = deriveKeypairFromMnemonic(mnemonic);
    assert.equal(
      publicKey,
      "GDRXE2BQUC3AZNPVFSCEZ76NJ3WWL25FYFK6RGZGIEKWE4SOOHSUJUJ6",
    );
    assert.equal(
      secret,
      "SBGWSG6BTNCKCOB3DIFBGCVMUPQFYPA2G4O34RMTB343OYPXU5DJDVMN",
    );
  });

  it("is deterministic and returns a valid G/S keypair for a generated mnemonic", () => {
    const mnemonic = generateMnemonic();
    const a = deriveKeypairFromMnemonic(mnemonic);
    const b = deriveKeypairFromMnemonic(mnemonic);
    assert.deepEqual(a, b);
    assert.ok(a.publicKey.startsWith("G") && a.publicKey.length === 56);
  });
});

describe("generateMnemonic", () => {
  it("produces a 12-word mnemonic", () => {
    assert.equal(generateMnemonic().trim().split(/\s+/).length, 12);
  });
});

describe("formatProvisionOutput", () => {
  it("emits only the KEY=VALUE lines for provided fields", () => {
    const out = formatProvisionOutput({
      mnemonic: "word ".repeat(11) + "word",
      recipient: "GABC",
      usdcCode: "USDC",
      usdcIssuer: "GBBD",
    });
    const lines = out.split("\n");
    assert.ok(lines.includes(`E2E_TEST_FUNDED_RECOVERY_PHRASE=${"word ".repeat(11)}word`));
    assert.ok(lines.includes("E2E_TEST_RECIPIENT_ADDRESS=GABC"));
    assert.ok(lines.includes("E2E_TEST_USDC_CODE=USDC"));
    assert.ok(lines.includes("E2E_TEST_USDC_ISSUER=GBBD"));
  });

  it("omits lines for absent fields", () => {
    const out = formatProvisionOutput({ mnemonic: "m" });
    assert.equal(out, "E2E_TEST_FUNDED_RECOVERY_PHRASE=m");
  });
});
