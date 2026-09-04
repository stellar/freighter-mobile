// Names that identify the native asset by itself: the normalized code, the
// raw Horizon asset-type sentinel, and the string literals both resolve to.
const NATIVE_LITERAL_VALUES = ["XLM", "native"];
const NATIVE_IDENTIFIER_NAMES = [
  "NATIVE_TOKEN_CODE",
  "HORIZON_NATIVE_ASSET_TYPE",
];

// Words that mean "this holds a code or a symbol" when they appear as one of
// the camelCase/snake_case words making up an identifier or property name —
// comparing such a name directly to a native-code literal singles out the
// native asset by string equality instead of going through a predicate.
// This is deliberately a word match, not a substring match: it must catch
// `srcTokenCode`, `tokenCode`, `asset_code`, `symbol`, `tokenSymbol`, etc.,
// while still ignoring names that merely contain these letters, such as
// `encoded` or `decodeUrl`.
const CODE_OR_SYMBOL_WORDS = ["code", "symbol"];

// The word that means "this is an issuer" — used both for a name that
// directly carries an issuer address/object, and for the object one level
// up in `<something>.issuer.key`.
const ISSUER_WORD = "issuer";

// Splits an identifier/property name into lowercase words on camelCase
// boundaries and underscores, e.g. "srcTokenCode" -> ["src", "token",
// "code"], "asset_code" -> ["asset", "code"].
function toWords(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .toLowerCase()
    .split("_")
    .filter(Boolean);
}

function hasWord(name, word) {
  return toWords(name).includes(word);
}

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

// Unwraps an optional-chaining member access (`a?.b`) to the plain member
// expression it wraps, so `t?.code` is inspected the same as `t.code`.
function unwrapChain(node) {
  return node.type === "ChainExpression" ? node.expression : node;
}

function isNativeLiteralSide(rawNode) {
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

function isCodeOrIssuerSide(rawNode) {
  const node = unwrapChain(rawNode);

  if (node.type === "Identifier") {
    return (
      CODE_OR_SYMBOL_WORDS.some((word) => hasWord(node.name, word)) ||
      hasWord(node.name, ISSUER_WORD)
    );
  }

  if (node.type === "MemberExpression") {
    const propertyName = getStaticPropertyName(node);
    if (
      propertyName &&
      (CODE_OR_SYMBOL_WORDS.some((word) => hasWord(propertyName, word)) ||
        hasWord(propertyName, ISSUER_WORD))
    ) {
      return true;
    }

    // `<something>.issuer.key`: "key" alone means nothing, but paired with
    // an issuer-named object one level up it identifies an issuer address.
    if (propertyName === "key") {
      const object = unwrapChain(node.object);
      if (object.type === "MemberExpression") {
        const objectPropertyName = getStaticPropertyName(object);
        return !!objectPropertyName && hasWord(objectPropertyName, ISSUER_WORD);
      }
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
