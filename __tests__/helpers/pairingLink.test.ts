import { parsePairingLink } from "helpers/pairingLink";

const REDIRECT = "freighterwallet://wc-redirect";

describe("parsePairingLink", () => {
  it.each([
    [`${REDIRECT}?uri=%FF`, { status: "invalid" }],
    [`${REDIRECT}?uri=%E0%A4%A`, { status: "invalid" }],
    [`not a url ${REDIRECT}?uri=wc%3Aabc`, { status: "invalid" }],
    [
      `${REDIRECT}?uri=wc%3Aabc%402%3FsymKey%3D00`,
      { status: "valid", uri: "wc:abc@2?symKey=00" },
    ],
    [REDIRECT, { status: "ignored" }],
    [`${REDIRECT}?uri=`, { status: "ignored" }],
    ["https://example.com/?uri=%FF", { status: "ignored" }],
    ["", { status: "ignored" }],
    [null, { status: "ignored" }],
    [undefined, { status: "ignored" }],
  ])("reads %p as %p", (url, expected) => {
    expect(parsePairingLink(url, REDIRECT)).toEqual(expected);
  });
});
