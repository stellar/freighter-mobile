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
    // Identifier-space comparisons are sound and must stay clean.
    { code: "tokenIdentifier === NATIVE_TOKEN_CODE;" },
    { code: "tokenId === NATIVE_TOKEN_CODE;" },
    { code: "key === NATIVE_TOKEN_CODE;" },
    { code: "record.asset === NATIVE_TOKEN_CODE;" },
    { code: "r.asset !== NATIVE_TOKEN_CODE;" },
    { code: "sourceTokenId !== NATIVE_TOKEN_CODE;" },
    // The word test must not over-match on names that merely contain the
    // letters "code" without that being a whole word of their own.
    { code: "decodeUrl === NATIVE_TOKEN_CODE;" },
    { code: "encoded === NATIVE_TOKEN_CODE;" },
  ],
  invalid: [
    {
      code: "tokenCode === NATIVE_TOKEN_CODE;",
      errors: [{ messageId: "noAssetCodeComparison" }],
    },
    {
      code: "balance.token.code === 'XLM';",
      errors: [{ messageId: "noAssetCodeComparison" }],
    },
    {
      code: "symbol === 'native';",
      errors: [{ messageId: "noAssetCodeComparison" }],
    },
    {
      code: "token.issuer === NATIVE_TOKEN_CODE;",
      errors: [{ messageId: "noAssetCodeComparison" }],
    },
    {
      code: "t.issuer.key === 'XLM';",
      errors: [{ messageId: "noAssetCodeComparison" }],
    },
    {
      code: "tokenCode !== NATIVE_TOKEN_CODE;",
      errors: [{ messageId: "noAssetCodeComparison" }],
    },
    // Aliases carrying the "code" word that are not in any hardcoded
    // exact-name list — this is the shape the rule must catch to detect a
    // revert of the swap mapper's fix.
    {
      code: "srcTokenCode === NATIVE_TOKEN_CODE;",
      errors: [{ messageId: "noAssetCodeComparison" }],
    },
    {
      code: "destTokenCodeFinal === NATIVE_TOKEN_CODE;",
      errors: [{ messageId: "noAssetCodeComparison" }],
    },
    {
      code: "asset_code === NATIVE_TOKEN_CODE;",
      errors: [{ messageId: "noAssetCodeComparison" }],
    },
    // Optional chaining must be unwrapped before inspecting each operand.
    {
      code: "t?.code === 'XLM';",
      errors: [{ messageId: "noAssetCodeComparison" }],
    },
    {
      code: "balance?.token?.issuer?.key === 'XLM';",
      errors: [{ messageId: "noAssetCodeComparison" }],
    },
  ],
});
