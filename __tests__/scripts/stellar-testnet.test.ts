// jest.setup.js mocks tweetnacl globally for the auth-flow tests, which stubs
// out the Ed25519 keypair derivation we actually want to verify here. Restore
// the real module for this file so deriveKeypairFromMnemonic can run.
// The implementation lives under e2e/scripts/lib/ (outside src/, no module
// alias) and stays as .mjs so it remains directly runnable via plain `node`
// from the runner script — both reasons we keep the relative path + explicit
// extension and silence the corresponding lint rules just for this import.
// eslint-disable-next-line @fnando/consistent-import/consistent-import
import {
  TESTNET_USDC_CODE,
  TESTNET_USDC_ISSUER,
  TESTNET_USDC,
  generateMnemonic,
  deriveKeypairFromMnemonic,
  formatProvisionOutput,
  // eslint-disable-next-line import/extensions
} from "../../e2e/scripts/lib/stellar-testnet.mjs";

jest.unmock("tweetnacl");

describe("pinned constants", () => {
  it("pins the canonical SDF testnet USDC asset", () => {
    expect(TESTNET_USDC_CODE).toBe("USDC");
    expect(TESTNET_USDC_ISSUER).toBe(
      "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
    );
  });

  it("constructs the TESTNET_USDC asset with the right code and issuer", () => {
    expect(TESTNET_USDC.getCode()).toBe(TESTNET_USDC_CODE);
    expect(TESTNET_USDC.getIssuer()).toBe(TESTNET_USDC_ISSUER);
  });
});

describe("deriveKeypairFromMnemonic", () => {
  it("matches the SEP-5 test vector (same derivation as the app)", () => {
    // SEP-0005 test vector 1, account 0. Confirms our derivation matches
    // stellar-hd-wallet as used in src/ducks/auth.ts (deriveKeyPair).
    const mnemonic =
      "illness spike retreat truth genius clock brain pass fit cave bargain toe";
    const { publicKey, secret } = deriveKeypairFromMnemonic(mnemonic);
    expect(publicKey).toBe(
      "GDRXE2BQUC3AZNPVFSCEZ76NJ3WWL25FYFK6RGZGIEKWE4SOOHSUJUJ6",
    );
    expect(secret).toBe(
      "SBGWSG6BTNCKCOB3DIFBGCVMUPQFYPA2G4O34RMTB343OYPXU5DJDVMN",
    );
  });

  it("is deterministic and returns a valid G/S keypair for a generated mnemonic", () => {
    const mnemonic = generateMnemonic();
    const a = deriveKeypairFromMnemonic(mnemonic);
    const b = deriveKeypairFromMnemonic(mnemonic);
    expect(a).toEqual(b);
    expect(a.publicKey.startsWith("G")).toBe(true);
    expect(a.publicKey.length).toBe(56);
  });
});

describe("generateMnemonic", () => {
  it("produces a 12-word mnemonic", () => {
    expect(generateMnemonic().trim().split(/\s+/).length).toBe(12);
  });
});

describe("formatProvisionOutput", () => {
  it("emits only the KEY=VALUE lines for provided fields", () => {
    const out = formatProvisionOutput({
      mnemonic: `${"word ".repeat(11)}word`,
      recipient: "GABC",
      usdcCode: "USDC",
      usdcIssuer: "GBBD",
    });
    const lines = out.split("\n");
    expect(lines).toContain(
      `E2E_TEST_FUNDED_RECOVERY_PHRASE=${"word ".repeat(11)}word`,
    );
    expect(lines).toContain("E2E_TEST_RECIPIENT_ADDRESS=GABC");
    expect(lines).toContain("E2E_TEST_USDC_CODE=USDC");
    expect(lines).toContain("E2E_TEST_USDC_ISSUER=GBBD");
  });

  it("omits lines for absent fields", () => {
    // The .mjs implementation destructures all four fields but treats each as
    // optional via truthy checks. TS's strict inference treats them as required;
    // cast keeps the partial-object call site clean and matches runtime intent.
    const out = formatProvisionOutput({
      mnemonic: "m",
    } as Parameters<typeof formatProvisionOutput>[0]);
    expect(out).toBe("E2E_TEST_FUNDED_RECOVERY_PHRASE=m");
  });
});
