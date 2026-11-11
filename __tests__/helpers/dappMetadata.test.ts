import { SessionTypes } from "@walletconnect/types";
import { DiscoverProtocol } from "config/types";
import { sanitizeDappMetadata, toConnectedDapp } from "helpers/dappMetadata";

const DAPP_URL = "https://dapp.example";
const EMPTY_METADATA = { name: "", description: "", url: "", icons: [] };

describe("toConnectedDapp", () => {
  const LISTED_PROTOCOL: DiscoverProtocol = {
    description: "A listed protocol",
    iconUrl: "https://cdn.example/listed.png",
    name: "Listed",
    websiteUrl: DAPP_URL,
    tags: [],
    isTrending: false,
  };

  const session = (metadata: unknown) =>
    ({ topic: "topic", peer: { metadata } }) as unknown as SessionTypes.Struct;

  it("names an unlisted dApp after its domain when its name isn't a string", () => {
    expect(toConnectedDapp(session({ name: 7, url: DAPP_URL }), [])).toEqual({
      topic: "topic",
      name: "dapp.example",
      favicon: undefined,
    });
  });

  it("uses the dApp's first string icon", () => {
    expect(
      toConnectedDapp(
        session({
          name: "dApp",
          url: DAPP_URL,
          icons: [1, `${DAPP_URL}/a.png`],
        }),
        [],
      ),
    ).toEqual({ topic: "topic", name: "dApp", favicon: `${DAPP_URL}/a.png` });
  });

  it("uses the listed protocol's name and icon when the dApp's url matches it", () => {
    expect(
      toConnectedDapp(
        session({ name: "Other", url: DAPP_URL, icons: [`${DAPP_URL}/a.png`] }),
        [LISTED_PROTOCOL],
      ),
    ).toEqual({
      topic: "topic",
      name: "Listed",
      favicon: "https://cdn.example/listed.png",
    });
  });

  it("returns an empty name and no icon for a session without a peer", () => {
    expect(
      toConnectedDapp({ topic: "topic" } as unknown as SessionTypes.Struct, []),
    ).toEqual({ topic: "topic", name: "", favicon: undefined });
  });
});

describe("sanitizeDappMetadata", () => {
  it("keeps well-formed metadata as is", () => {
    const metadata = {
      name: "dApp",
      description: "A dApp",
      url: DAPP_URL,
      icons: [`${DAPP_URL}/icon.png`],
    };

    expect(sanitizeDappMetadata(metadata)).toEqual(metadata);
  });

  it.each([null, undefined, "metadata", 7, []])(
    "returns empty metadata for %p",
    (input) => {
      expect(sanitizeDappMetadata(input)).toEqual(EMPTY_METADATA);
    },
  );

  it.each([7, null, "", "   ", { first: "dApp" }])(
    "names the dApp after its domain when the name is %p",
    (name) => {
      expect(sanitizeDappMetadata({ name, url: DAPP_URL }).name).toBe(
        "dapp.example",
      );
    },
  );

  it("leaves the name empty when there is no usable name or url", () => {
    expect(sanitizeDappMetadata({ name: 7, url: "not a url" }).name).toBe("");
  });

  it("caps the name at 100 characters and the description at 500", () => {
    const result = sanitizeDappMetadata({
      name: "n".repeat(101),
      description: "d".repeat(501),
      url: DAPP_URL,
    });

    expect(result.name).toBe("n".repeat(100));
    expect(result.description).toBe("d".repeat(500));
  });

  it("drops a url longer than 2048 characters instead of truncating it", () => {
    const longUrl = `${DAPP_URL}/${"a".repeat(2048 - DAPP_URL.length)}`;

    expect(longUrl).toHaveLength(2049);
    expect(sanitizeDappMetadata({ url: longUrl }).url).toBe("");
    expect(sanitizeDappMetadata({ url: longUrl.slice(0, 2048) }).url).toBe(
      longUrl.slice(0, 2048),
    );
  });

  it.each([42, null, { href: DAPP_URL }])("drops a url that is %p", (url) => {
    expect(sanitizeDappMetadata({ url }).url).toBe("");
  });

  it.each([undefined, null, `${DAPP_URL}/icon.png`, { 0: "x" }])(
    "returns no icons when icons is %p",
    (icons) => {
      expect(sanitizeDappMetadata({ url: DAPP_URL, icons }).icons).toEqual([]);
    },
  );

  it("keeps only string icons of at most 2048 characters, five at most", () => {
    const icons = [
      1,
      null,
      `${DAPP_URL}/${"a".repeat(3000)}`,
      `${DAPP_URL}/0.png`,
      `${DAPP_URL}/1.png`,
      `${DAPP_URL}/2.png`,
      `${DAPP_URL}/3.png`,
      `${DAPP_URL}/4.png`,
      `${DAPP_URL}/5.png`,
    ];

    expect(sanitizeDappMetadata({ url: DAPP_URL, icons }).icons).toEqual([
      `${DAPP_URL}/0.png`,
      `${DAPP_URL}/1.png`,
      `${DAPP_URL}/2.png`,
      `${DAPP_URL}/3.png`,
      `${DAPP_URL}/4.png`,
    ]);
  });
});
