// Prettier sorts built-in test imports with absolute application imports.
/* eslint-disable import/order */
import {
  Keypair,
  StellarToml,
  TransactionBuilder,
  WebAuth,
} from "@stellar/stellar-sdk";
import { prepareSep10Auth } from "services/webview/sep10";

const TESTNET = "Test SDF Network ; September 2015";
const server = Keypair.random();
const client = Keypair.random();
const account = {
  address: client.publicKey(),
  chainId: "stellar:testnet",
  networkPassphrase: TESTNET,
};
const endpoint = "https://testnet-api.xoxno.com/user/stellar/challenge";

const challengeFor = (
  homeDomain: string,
  webAuthDomain = "testnet-api.xoxno.com",
) =>
  WebAuth.buildChallengeTx(
    server,
    client.publicKey(),
    homeDomain,
    300,
    TESTNET,
    webAuthDomain,
  );

const install = ({
  toml = {
    WEB_AUTH_ENDPOINT: endpoint,
    SIGNING_KEY: server.publicKey(),
    NETWORK_PASSPHRASE: TESTNET,
  },
  challenge = challengeFor("xoxno.com"),
  passphraseField = "networkPassphrase",
}: {
  toml?: Record<string, unknown>;
  challenge?: string;
  passphraseField?: string;
} = {}) => {
  jest.spyOn(StellarToml.Resolver, "resolve").mockResolvedValue(toml as never);
  const fetchMock = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({ transaction: challenge, [passphraseField]: TESTNET }),
    }),
  );
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
};

const signTransaction = jest.fn(
  (tx: { sign: (k: Keypair) => void; toXdr: () => string }) => {
    tx.sign(client);
    return tx.toXdr();
  },
);

afterEach(() => {
  jest.restoreAllMocks();
  signTransaction.mockClear();
});

describe("prepareSep10Auth", () => {
  it("countersigns a genuine challenge for the site and account", async () => {
    const fetchMock = install();
    const auth = await prepareSep10Auth({
      origin: "https://xoxno.com",
      account,
      development: false,
      signTransaction,
    });
    expect(auth).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      `${endpoint}?account=${client.publicKey()}`,
      expect.anything(),
    );
    const signed = TransactionBuilder.fromXDR(auth!.signedXdr, TESTNET);
    expect("signatures" in signed && signed.signatures).toHaveLength(2);
    expect(auth!.homeDomain).toBe("xoxno.com");
    expect(auth!.networkPassphrase).toBe(TESTNET);
  });

  it("accepts the snake_case SEP-10 field name too", async () => {
    install({ passphraseField: "network_passphrase" });
    await expect(
      prepareSep10Auth({
        origin: "https://xoxno.com",
        account,
        development: false,
        signTransaction,
      }),
    ).resolves.not.toBeNull();
  });

  it("refuses a challenge signed by a key other than the TOML SIGNING_KEY", async () => {
    install({
      toml: {
        WEB_AUTH_ENDPOINT: endpoint,
        SIGNING_KEY: Keypair.random().publicKey(),
        NETWORK_PASSPHRASE: TESTNET,
      },
    });
    await expect(
      prepareSep10Auth({
        origin: "https://xoxno.com",
        account,
        development: false,
        signTransaction,
      }),
    ).resolves.toBeNull();
    expect(signTransaction).not.toHaveBeenCalled();
  });

  it("refuses a challenge for another account, another domain, or another network", async () => {
    const other = Keypair.random().publicKey();
    install({
      challenge: WebAuth.buildChallengeTx(
        server,
        other,
        "xoxno.com",
        300,
        TESTNET,
        "testnet-api.xoxno.com",
      ),
    });
    await expect(
      prepareSep10Auth({
        origin: "https://xoxno.com",
        account,
        development: false,
        signTransaction,
      }),
    ).resolves.toBeNull();
    install({ challenge: challengeFor("evil.example") });
    await expect(
      prepareSep10Auth({
        origin: "https://xoxno.com",
        account,
        development: false,
        signTransaction,
      }),
    ).resolves.toBeNull();
    // A subdomain must not be able to sign in as the user on its parent: a
    // genuine xoxno.com challenge is refused when the page is *.xoxno.com.
    install({ challenge: challengeFor("xoxno.com") });
    await expect(
      prepareSep10Auth({
        origin: "https://evil.xoxno.com",
        account,
        development: false,
        signTransaction,
      }),
    ).resolves.toBeNull();
    install();
    await expect(
      prepareSep10Auth({
        origin: "https://xoxno.com",
        account: {
          ...account,
          networkPassphrase: "Public Global Stellar Network ; September 2015",
        },
        development: false,
        signTransaction,
      }),
    ).resolves.toBeNull();
    expect(signTransaction).not.toHaveBeenCalled();
  });

  it("refuses a non-https endpoint outside development and a TOML without SEP-10 fields", async () => {
    install({
      toml: {
        WEB_AUTH_ENDPOINT:
          "http://testnet-api.xoxno.com/user/stellar/challenge",
        SIGNING_KEY: server.publicKey(),
        NETWORK_PASSPHRASE: TESTNET,
      },
    });
    await expect(
      prepareSep10Auth({
        origin: "https://xoxno.com",
        account,
        development: false,
        signTransaction,
      }),
    ).resolves.toBeNull();
    install({ toml: { NETWORK_PASSPHRASE: TESTNET } });
    await expect(
      prepareSep10Auth({
        origin: "https://xoxno.com",
        account,
        development: false,
        signTransaction,
      }),
    ).resolves.toBeNull();
    expect(signTransaction).not.toHaveBeenCalled();
  });
});
