import { FlatCompat } from "@eslint/eslintrc";
import js from "@eslint/js";
import globals from "globals";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

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
        ...globals.browser,
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

      "import/order": [
        "error",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
          ],
          "newlines-between": "always",
          alphabetize: { order: "asc" },
        },
      ],
      "react/require-default-props": "off",
      "import/prefer-default-export": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",

      // Add these rules to match Prettier config and make sure we use double quotes
      quotes: ["error", "double"],
      "@typescript-eslint/quotes": ["error", "double"],

      "no-param-reassign": [
        "error",
        {
          props: true,
          // Allows direct state mutations in Redux reducers (which is safe due to Immer)
          ignorePropertyModificationsFor: ["state"],
        },
      ],
    },
  },
];
