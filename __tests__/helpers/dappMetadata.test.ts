import { sanitizeDappMetadata } from "helpers/dappMetadata";

const DAPP_URL = "https://dapp.example";
const EMPTY_METADATA = { name: "", description: "", url: "", icons: [] };

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
