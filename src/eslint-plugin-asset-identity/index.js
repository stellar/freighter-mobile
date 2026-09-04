// Names that identify the native asset by itself: the normalized code, the
// raw Horizon asset-type sentinel, and the string literals both resolve to.
const NATIVE_LITERAL_VALUES = ["XLM", "native"];
const NATIVE_IDENTIFIER_NAMES = [
  "NATIVE_TOKEN_CODE",
  "HORIZON_NATIVE_ASSET_TYPE",
];

// Identifiers/property names that carry a code or an issuer for some asset —
// comparing one of these directly to a native-code literal singles out the
// native asset by string equality instead of going through a predicate.
const CODE_OR_ISSUER_NAMES = [
  "code",
  "tokenCode",
  "assetCode",
  "symbol",
  "tokenSymbol",
  "issuer",
  "tokenIssuer",
  "assetIssuer",
];

// Object property names that mean "this is an issuer" one level up, so that
// `<something>.issuer.key` is recognized even though "key" alone is not
// asset-identity-bearing.
const ISSUER_OBJECT_NAMES = ["issuer", "tokenIssuer", "assetIssuer"];

function getStaticPropertyName(node) {
  if (!node.computed) {
    return node.property.type === "Identifier" ? node.property.name : null;
  }
  if (
    node.property.type === "Literal" &&
    typeof node.property.value === "string"
  ) {
    return node.property.value;
  }
  return null;
}

function isNativeLiteralSide(node) {
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

function isCodeOrIssuerSide(node) {
  if (node.type === "Identifier") {
    return CODE_OR_ISSUER_NAMES.includes(node.name);
  }

  if (node.type === "MemberExpression") {
    const propertyName = getStaticPropertyName(node);
    if (propertyName && CODE_OR_ISSUER_NAMES.includes(propertyName)) {
      return true;
    }

    // `<something>.issuer.key`: "key" alone means nothing, but paired with
    // an issuer-named object one level up it identifies an issuer address.
    if (propertyName === "key" && node.object.type === "MemberExpression") {
      const objectPropertyName = getStaticPropertyName(node.object);
      return (
        !!objectPropertyName && ISSUER_OBJECT_NAMES.includes(objectPropertyName)
      );
    }
  }

  return false;
}

const noAssetCodeComparisonRule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow comparing an asset code or issuer directly to a native-asset literal",
      category: "Best Practices",
      recommended: true,
    },
    fixable: null,
    schema: [],
    messages: {
      noAssetCodeComparison:
        "Identify the native asset with a predicate from helpers/assetIdentity — or isNativeAssetId for canonical identifiers — instead of comparing an asset code or issuer to a code literal.",
    },
  },

  create(context) {
    return {
      BinaryExpression(node) {
        if (node.operator !== "===" && node.operator !== "!==") {
          return;
        }

        const { left, right } = node;

        const flags =
          (isNativeLiteralSide(left) && isCodeOrIssuerSide(right)) ||
          (isNativeLiteralSide(right) && isCodeOrIssuerSide(left));

        if (flags) {
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
