import globals from "globals";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

// Need to add this to fix the AudioWorkletGlobalScope eslint
const GLOBALS_BROWSER_FIX = {
  ...globals.browser,
  AudioWorkletGlobalScope: globals.browser["AudioWorkletGlobalScope "],
};
delete GLOBALS_BROWSER_FIX["AudioWorkletGlobalScope "];

export default [
  ...compat.extends(
    "airbnb",
    "airbnb-typescript",
    "airbnb/hooks",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
  ),
  {
    languageOptions: {
      globals: {
        ...GLOBALS_BROWSER_FIX,
      },

      ecmaVersion: "latest",
      sourceType: "script",

      parserOptions: {
        project: "tsconfig.json",
      },
    },

    rules: {
      // Allow arrow functions in React components
      "react/function-component-definition": [
        2,
        {
          namedComponents: "arrow-function",
          unnamedComponents: "arrow-function",
        },
      ],
      "no-param-reassign": [
        "error",
        {
          props: true,
          // Allows direct state mutations in Redux reducers (which is safe due to Immer)
          ignorePropertyModificationsFor: ["state"],
        },
      ],
      "import/prefer-default-export": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "react/require-default-props": "off",

      // Add these rules to match Prettier config and make sure we use double quotes
      quotes: ["error", "double"],
      "@typescript-eslint/quotes": ["error", "double"],
    },
  },
];
