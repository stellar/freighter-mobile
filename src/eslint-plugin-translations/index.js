const fs = require("fs");
const path = require("path");

function getTranslationKeys(obj, prefix = "") {
  const keys = [];
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const newPrefix = prefix ? `${prefix}.${key}` : key;
      if (
        typeof obj[key] === "object" &&
        obj[key] !== null &&
        !Array.isArray(obj[key])
      ) {
        keys.push(...getTranslationKeys(obj[key], newPrefix));
      } else {
        keys.push(newPrefix);
      }
    }
  }
  return keys;
}

function loadTranslations(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return {};
    }
    const content = fs.readFileSync(filePath, "utf8");
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error loading translations from ${filePath}:`, error);
    return {};
  }
}

function findProjectRoot(currentDir) {
  // Look for package.json to find project root
  while (currentDir !== path.dirname(currentDir)) {
    if (fs.existsSync(path.join(currentDir, "package.json"))) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }
  return process.cwd();
}

// Global cache to track missing translations across all files
let missingTranslationsCache = new Map();
let hasReportedSummary = false;

const missingTranslationsRule = {
  meta: {
    type: "problem",
    docs: {
      description: "Ensure all translation keys exist in all language files",
      category: "Best Practices",
      recommended: true,
    },
    fixable: null,
    schema: [],
    messages: {
      missingTranslation:
        'Missing translation key "{{key}}" in {{locale}} locale',
      missingLocale: "Missing locale file: {{locale}}",
      translationError: "Error checking translations: {{error}}",
      missingTranslationsSummary:
        "{{count}} translation keys are missing in {{locale}} locale.",
    },
  },

  create(context) {
    let hasCheckedTranslations = false;
    let translationNodes = [];

    return {
      // Check for import statements
      ImportDeclaration(node) {
        const source = node.source.value;
        if (
          source === "react-i18next" ||
          source === "i18next" ||
          source.includes("i18n") ||
          source.includes("translations")
        ) {
          // Collect this node for later checking
          translationNodes.push(node);
        }
      },

      // Check for require statements
      CallExpression(node) {
        if (
          node.callee.type === "Identifier" &&
          node.callee.name === "require" &&
          node.arguments.length > 0 &&
          node.arguments[0].type === "Literal"
        ) {
          const source = node.arguments[0].value;
          if (
            source === "react-i18next" ||
            source === "i18next" ||
            source.includes("i18n") ||
            source.includes("translations")
          ) {
            translationNodes.push(node);
          }
        }
      },

      // Check for useTranslation hook usage
      CallExpression(node) {
        if (
          node.callee.type === "Identifier" &&
          node.callee.name === "useTranslation"
        ) {
          translationNodes.push(node);
        }
      },

      // Check for t() function calls (translation function)
      CallExpression(node) {
        if (
          node.callee.type === "MemberExpression" &&
          node.callee.property &&
          node.callee.property.name === "t"
        ) {
          translationNodes.push(node);
        }
      },

      // Check for direct translation key usage in JSX
      JSXAttribute(node) {
        if (
          node.name &&
          node.name.name === "children" &&
          node.value &&
          node.value.type === "Literal" &&
          typeof node.value.value === "string" &&
          (node.value.value.includes("{{") || node.value.value.includes("}}"))
        ) {
          translationNodes.push(node);
        }
      },

      // Check translations after the entire file has been parsed
      "Program:exit"() {
        if (translationNodes.length > 0 && !hasCheckedTranslations) {
          checkTranslations(context, translationNodes);
          hasCheckedTranslations = true;
        }
      },
    };
  },
};

function checkTranslations(context, translationNodes) {
  try {
    const projectRoot = findProjectRoot(context.getCwd());
    const enPath = path.join(
      projectRoot,
      "src/i18n/locales/en/translations.json",
    );
    const ptPath = path.join(
      projectRoot,
      "src/i18n/locales/pt/translations.json",
    );

    // Check if translation files exist
    if (!fs.existsSync(enPath)) {
      // Report on the first translation-related node
      if (translationNodes.length > 0) {
        context.report({
          node: translationNodes[0],
          messageId: "missingLocale",
          data: { locale: "en" },
        });
      }
      return;
    }

    if (!fs.existsSync(ptPath)) {
      // Report on the first translation-related node
      if (translationNodes.length > 0) {
        context.report({
          node: translationNodes[0],
          messageId: "missingLocale",
          data: { locale: "pt" },
        });
      }
      return;
    }

    // Load translations
    const enTranslations = loadTranslations(enPath);
    const ptTranslations = loadTranslations(ptPath);

    // Get all keys from both files
    const enKeys = new Set(getTranslationKeys(enTranslations));
    const ptKeys = new Set(getTranslationKeys(ptTranslations));

    // Find missing keys
    const missingInPt = [];
    const missingInEn = [];

    for (const key of enKeys) {
      if (!ptKeys.has(key)) {
        missingInPt.push(key);
      }
    }

    for (const key of ptKeys) {
      if (!enKeys.has(key)) {
        missingInEn.push(key);
      }
    }

    // Report missing translations on specific nodes
    const currentFile = context.getFilename();

    // Check Portuguese translations
    for (const key of missingInPt) {
      const cacheKey = `pt:${key}`;
      if (!missingTranslationsCache.has(cacheKey)) {
        missingTranslationsCache.set(cacheKey, currentFile);
        // Report on the first translation-related node
        context.report({
          node: translationNodes[0],
          messageId: "missingTranslation",
          data: { key, locale: "pt" },
        });
      }
    }

    // Check English translations
    for (const key of missingInEn) {
      const cacheKey = `en:${key}`;
      if (!missingTranslationsCache.has(cacheKey)) {
        missingTranslationsCache.set(cacheKey, currentFile);
        // Report on the first translation-related node
        context.report({
          node: translationNodes[0],
          messageId: "missingTranslation",
          data: { key, locale: "en" },
        });
      }
    }

    // Report summary only once at the end
    if (
      !hasReportedSummary &&
      (missingInPt.length > 0 || missingInEn.length > 0)
    ) {
      hasReportedSummary = true;

      if (missingInPt.length > 0) {
        context.report({
          node: translationNodes[0],
          messageId: "missingTranslationsSummary",
          data: { count: missingInPt.length, locale: "pt" },
        });
      }

      if (missingInEn.length > 0) {
        context.report({
          node: translationNodes[0],
          messageId: "missingTranslationsSummary",
          data: { count: missingInEn.length, locale: "en" },
        });
      }
    }
  } catch (error) {
    // Report error on the first translation-related node
    if (translationNodes.length > 0) {
      context.report({
        node: translationNodes[0],
        messageId: "translationError",
        data: { error: error.message },
      });
    }
  }
}

module.exports = {
  rules: {
    "missing-translations": missingTranslationsRule,
  },
};
