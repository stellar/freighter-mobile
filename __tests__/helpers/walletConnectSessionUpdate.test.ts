import { Core } from "@walletconnect/core";
// The sign client comes with @reown/walletkit; this test drives it directly to
// pin the behavior of the version WalletKit brings.
// eslint-disable-next-line import/no-extraneous-dependencies
import { SignClient } from "@walletconnect/sign-client";

/**
 * A connected dApp must not be able to change what the user approved. The
 * wallet controls its sessions, so WalletConnect's sign client has to refuse
 * a session update the dApp sends, before applying it or telling the wallet.
 * This drives the sign client's own handler for an incoming update.
 */
describe("WalletConnect session updates sent by a dApp", () => {
  const WALLET_KEY = "wallet-public-key";
  const DAPP_KEY = "dapp-public-key";

  const session = {
    topic: "topic",
    controller: WALLET_KEY,
    self: { publicKey: WALLET_KEY },
    peer: { publicKey: DAPP_KEY, metadata: { name: "dApp" } },
    namespaces: {
      stellar: {
        accounts: ["stellar:testnet:GACCOUNT"],
        methods: ["stellar_signXDR"],
        events: [],
      },
    },
    requiredNamespaces: {},
  };

  it("refuses an update from the dApp and leaves the session as approved", async () => {
    const core = new Core({ projectId: "test-project" });
    const client = new SignClient({ core, projectId: "test-project" });
    const { engine } = client as unknown as {
      engine: {
        onSessionUpdateRequest: (
          topic: string,
          payload: unknown,
        ) => Promise<void>;
        isValidUpdate: jest.Mock;
        sendError: jest.Mock;
        sendResult: jest.Mock;
      };
    };
    const update = jest.fn();
    const emit = jest.fn();
    (client as unknown as { session: unknown }).session = {
      get: () => session,
      update,
    };
    (client as unknown as { events: unknown }).events = { emit };
    engine.isValidUpdate = jest.fn().mockResolvedValue(undefined);
    engine.sendError = jest.fn().mockResolvedValue(undefined);
    engine.sendResult = jest.fn().mockResolvedValue(undefined);

    await engine.onSessionUpdateRequest("topic", {
      id: 1794460000000123,
      jsonrpc: "2.0",
      method: "wc_sessionUpdate",
      params: { namespaces: {} },
    });

    expect(update).not.toHaveBeenCalled();
    expect(engine.sendResult).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalledWith("session_update", expect.anything());
    expect(engine.sendError).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 1794460000000123,
        topic: "topic",
        error: expect.objectContaining({ code: 3003 }),
      }),
    );
  });
});
