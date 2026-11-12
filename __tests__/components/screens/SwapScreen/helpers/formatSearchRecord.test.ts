import { formatSearchRecord } from "components/screens/SwapScreen/helpers/formatSearchRecord";
import { TokenTypeWithCustomToken } from "config/types";

const CONTRACT = "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75";

describe("formatSearchRecord", () => {
  it("names a contract token by its code, then its toml code", () => {
    const record = { asset: CONTRACT, tomlInfo: { code: "TOML" } } as never;

    expect(formatSearchRecord(record, () => false)).toMatchObject({
      tokenCode: "TOML",
      issuer: CONTRACT,
      tokenType: TokenTypeWithCustomToken.CUSTOM_TOKEN,
    });
  });

  it("names a contract token with an empty code by its shortened ID too", () => {
    const record = { asset: CONTRACT, code: "" } as never;

    expect(formatSearchRecord(record, () => false).tokenCode).toBe(
      "CCW6...MI75",
    );
  });

  it("names a contract token with no code by its shortened ID, as the extension does", () => {
    const record = { asset: CONTRACT } as never;

    expect(formatSearchRecord(record, () => false).tokenCode).toBe(
      "CCW6...MI75",
    );
  });
});
