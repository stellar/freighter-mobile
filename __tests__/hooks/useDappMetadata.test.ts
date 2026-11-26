import {
  ActiveSessions,
  WalletKitEvent,
  WalletKitEventTypes,
} from "ducks/walletKit";
import { getDappMetadataFromEvent } from "hooks/useDappMetadata";

const DAPP_URL = "https://dapp.example";

const proposal = (proposer: unknown) =>
  ({
    type: WalletKitEventTypes.SESSION_PROPOSAL,
    params: { proposer },
  }) as unknown as WalletKitEvent;

const request = (topic: string) =>
  ({ type: WalletKitEventTypes.SESSION_REQUEST, topic }) as WalletKitEvent;

const sessions = (key: string, metadata: unknown) =>
  ({
    [key]: { topic: "topic", peer: { metadata } },
  }) as unknown as ActiveSessions;

describe("getDappMetadataFromEvent", () => {
  it("normalizes a proposal's metadata", () => {
    expect(
      getDappMetadataFromEvent(
        proposal({ metadata: { name: 7, url: DAPP_URL } }),
        {},
      ),
    ).toEqual({
      name: "dapp.example",
      description: "",
      url: DAPP_URL,
      icons: [],
    });
  });

  it("returns empty metadata for a proposal without metadata", () => {
    expect(getDappMetadataFromEvent(proposal({}), {})).toEqual({
      name: "",
      description: "",
      url: "",
      icons: [],
    });
  });

  it("normalizes the metadata of the session a request belongs to", () => {
    expect(
      getDappMetadataFromEvent(
        request("topic"),
        sessions("topic", {
          name: "dApp",
          url: DAPP_URL,
          icons: `${DAPP_URL}/icon.png`,
        }),
      ),
    ).toEqual({ name: "dApp", description: "", url: DAPP_URL, icons: [] });
  });

  it("normalizes the metadata of a session found by its topic field", () => {
    expect(
      getDappMetadataFromEvent(
        request("topic"),
        sessions("other-key", { name: 7, url: DAPP_URL }),
      ),
    ).toEqual({
      name: "dapp.example",
      description: "",
      url: DAPP_URL,
      icons: [],
    });
  });
});
