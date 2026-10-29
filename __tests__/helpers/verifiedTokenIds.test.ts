import {
  buildVerifiedTokenIds,
  isTokenInVerifiedIds,
} from "helpers/verifiedTokenIds";

const ISSUER = "GDJ5BNU5NN6NQ54D7OX6NQTUYNBZ42CAT33QGM5BIQ2QIYADAC5ICH47";
const CONTRACT = "CCNOV6XVI2O5BSTA3232GIRUQULDEBV7IWGKM6QKI6II5OIIQTU24JJN";
const OTHER_CONTRACT =
  "CACSKWC753QVGC4J6YPDBIR2BEHFVWIAE7CBSS3HOVYMN623OAIQYE2M";

describe("verifiedTokenIds", () => {
  it("verifies a classic token only for the listed code", () => {
    const ids = buildVerifiedTokenIds([{ code: "USDE", issuer: ISSUER }]);

    expect(
      isTokenInVerifiedIds(ids, { tokenCode: "USDE", issuer: ISSUER }),
    ).toBe(true);
    expect(
      isTokenInVerifiedIds(ids, { tokenCode: "USDe", issuer: ISSUER }),
    ).toBe(false);
  });

  it("verifies a contract listed in the issuer field for any code", () => {
    const ids = buildVerifiedTokenIds([{ code: "USDE", issuer: CONTRACT }]);

    expect(
      isTokenInVerifiedIds(ids, { tokenCode: "USDE", issuer: CONTRACT }),
    ).toBe(true);
    expect(
      isTokenInVerifiedIds(ids, { tokenCode: "OTHER", issuer: CONTRACT }),
    ).toBe(true);
    expect(
      isTokenInVerifiedIds(ids, { tokenCode: "USDE", issuer: OTHER_CONTRACT }),
    ).toBe(false);
  });

  it("verifies a contract listed in the contract field for any code", () => {
    const ids = buildVerifiedTokenIds([
      { code: "USDE", issuer: ISSUER, contract: CONTRACT },
    ]);

    expect(
      isTokenInVerifiedIds(ids, { tokenCode: "OTHER", issuer: CONTRACT }),
    ).toBe(true);
  });

  it("does not verify a token without an issuer", () => {
    const ids = buildVerifiedTokenIds([{ code: "USDE", issuer: ISSUER }]);

    expect(isTokenInVerifiedIds(ids, { tokenCode: "USDE", issuer: "" })).toBe(
      false,
    );
  });
});
