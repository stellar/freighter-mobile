// ESLint 9's flat-config RuleTester ships in 8.57 under this entry point;
// the default `eslint` export still validates against the eslintrc schema.
// No type declarations exist for this subpath, so it is required rather
// than imported.
/* eslint-disable global-require, @typescript-eslint/no-var-requires */
const { FlatRuleTester: RuleTester } = require("eslint/use-at-your-own-risk");

const assetIdentityPlugin = require("../../src/eslint-plugin-asset-identity");
/* eslint-enable global-require, @typescript-eslint/no-var-requires */

const rule = assetIdentityPlugin.rules["no-asset-code-comparison"];

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
});

ruleTester.run("no-asset-code-comparison", rule, {
  valid: [
    // No sentinel on either side — a bare code-to-code comparison never
    // triggers the rule, no matter how "code"-ish the names look.
    { code: "tokenCode === otherCode;" },
    { code: "asset.code === USDC_CODE;" },
    // An unrelated string literal is not a native sentinel.
    { code: "status === 'pending';" },
  ],
  invalid: [
    // Both sentinel string literals, both operand orders.
    {
      code: "code === 'XLM';",
      errors: [{ messageId: "noAssetCodeComparison" }],
    },
    {
      code: "'XLM' === code;",
      errors: [{ messageId: "noAssetCodeComparison" }],
    },
    {
      code: "code === 'native';",
      errors: [{ messageId: "noAssetCodeComparison" }],
    },
    {
      code: "'native' === code;",
      errors: [{ messageId: "noAssetCodeComparison" }],
    },
    // Both sentinel identifiers, both operand orders.
    {
      code: "code === NATIVE_TOKEN_CODE;",
      errors: [{ messageId: "noAssetCodeComparison" }],
    },
    {
      code: "NATIVE_TOKEN_CODE === code;",
      errors: [{ messageId: "noAssetCodeComparison" }],
    },
    {
      code: "code === HORIZON_NATIVE_ASSET_TYPE;",
      errors: [{ messageId: "noAssetCodeComparison" }],
    },
    {
      code: "HORIZON_NATIVE_ASSET_TYPE === code;",
      errors: [{ messageId: "noAssetCodeComparison" }],
    },
    // !== is covered exactly like ===.
    {
      code: "code !== 'native';",
      errors: [{ messageId: "noAssetCodeComparison" }],
    },
    {
      code: "code !== NATIVE_TOKEN_CODE;",
      errors: [{ messageId: "noAssetCodeComparison" }],
    },
    // Optional chaining on the non-sentinel side must still be unwrapped
    // correctly, in either operand order.
    {
      code: "t?.code === 'XLM';",
      errors: [{ messageId: "noAssetCodeComparison" }],
    },
    {
      code: "NATIVE_TOKEN_CODE === balance?.token?.issuer?.key;",
      errors: [{ messageId: "noAssetCodeComparison" }],
    },
    // The rule no longer inspects the other operand at all, so any
    // identifier — not just one spelling "code", "symbol" or "issuer" —
    // is flagged once a sentinel sits on the other side. These were all
    // listed under `valid` before the heuristic was removed.
    {
      code: "tokenIdentifier === NATIVE_TOKEN_CODE;",
      errors: [{ messageId: "noAssetCodeComparison" }],
    },
    {
      code: "tokenId === NATIVE_TOKEN_CODE;",
      errors: [{ messageId: "noAssetCodeComparison" }],
    },
    {
      code: "key === NATIVE_TOKEN_CODE;",
      errors: [{ messageId: "noAssetCodeComparison" }],
    },
    {
      code: "record.asset === NATIVE_TOKEN_CODE;",
      errors: [{ messageId: "noAssetCodeComparison" }],
    },
    {
      code: "r.asset !== NATIVE_TOKEN_CODE;",
      errors: [{ messageId: "noAssetCodeComparison" }],
    },
    {
      code: "sourceTokenId !== NATIVE_TOKEN_CODE;",
      errors: [{ messageId: "noAssetCodeComparison" }],
    },
    // Names that merely contain the letters "code" without that being a
    // whole word used to be the rule's own false-negative regression
    // check; now they are ordinary hits like everything else.
    {
      code: "decodeUrl === NATIVE_TOKEN_CODE;",
      errors: [{ messageId: "noAssetCodeComparison" }],
    },
    {
      code: "encoded === NATIVE_TOKEN_CODE;",
      errors: [{ messageId: "noAssetCodeComparison" }],
    },
  ],
});
