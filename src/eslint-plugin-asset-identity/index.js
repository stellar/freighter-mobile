// Sentinel values that identify the native asset by themselves: the
// normalized code, the raw Horizon asset-type string, and the identifiers
// that hold them. An asset's identity is (code, issuer) — or, for a
// contract token, its contract id — so comparing anything directly to one
// of these sentinels is unsound regardless of what the other operand is;
// it must go through a predicate instead.
const NATIVE_LITERAL_VALUES = ["XLM", "native"];
const NATIVE_IDENTIFIER_NAMES = [
  "NATIVE_TOKEN_CODE",
  "HORIZON_NATIVE_ASSET_TYPE",
];

// Unwraps an optional-chaining member access (`a?.b`) to the plain member
// expression it wraps, so `t?.code` is inspected the same as `t.code`.
function unwrapChain(node) {
  return node.type === "ChainExpression" ? node.expression : node;
}

function isNativeSentinel(rawNode) {
  const node = unwrapChain(rawNode);
  if (
    node.type === "Literal" &&
    typeof node.value === "string" &&
    NATIVE_LITERAL_VALUES.includes(node.value)
  ) {
    return true;
  }
  return (
    node.type === "Identifier" && NATIVE_IDENTIFIER_NAMES.includes(node.name)
  );
}

const noAssetCodeComparisonRule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow comparing anything directly to a native-asset sentinel",
      category: "Best Practices",
      recommended: true,
    },
    fixable: null,
    schema: [],
    messages: {
      noAssetCodeComparison:
        "Identify the native asset with a predicate from helpers/assetIdentity — or isNativeAssetId for canonical identifiers — instead of comparing it to a native-asset sentinel.",
    },
  },

  create(context) {
    return {
      BinaryExpression(node) {
        if (node.operator !== "===" && node.operator !== "!==") {
          return;
        }

        if (isNativeSentinel(node.left) || isNativeSentinel(node.right)) {
          context.report({ node, messageId: "noAssetCodeComparison" });
        }
      },
    };
  },
};

module.exports = {
  rules: {
    "no-asset-code-comparison": noAssetCodeComparisonRule,
  },
};
