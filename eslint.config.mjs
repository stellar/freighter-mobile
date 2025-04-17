/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable no-underscore-dangle */
/* eslint-disable import/no-extraneous-dependencies */
import path from "node:path";
import { fileURLToPath } from "node:url";

import { FlatCompat } from "@eslint/eslintrc";
import js from "@eslint/js";
import consistentImport from "@fnando/eslint-plugin-consistent-import";
import globals from "globals";

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
    "prettier",
  ),
  {
    files: ["**/*.test.ts", "**/*.test.tsx", "**/__tests__/**/*"],
    rules: {
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-return": "off",
    },
  },
  {
    ignores: ["jest.setup.js", "tsconfig.json", "shim.js"],
  },
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        project: "tsconfig.json",
      },
    },
    plugins: {
      "@fnando/consistent-import": consistentImport,
    },
    rules: {
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

      "@fnando/consistent-import/consistent-import": [
        "error",
        {
          disallowRelative: true,
          rootDir: "src",
          prefix: "",
        },
      ],

      // Allow arrow functions in React components
      "react/function-component-definition": [
        2,
        {
          namedComponents: "arrow-function",
          unnamedComponents: "arrow-function",
        },
      ],

      "react/require-default-props": "off",
      "react/jsx-props-no-spreading": "off",
      "import/prefer-default-export": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-base-to-string": "off",
      "@typescript-eslint/no-floating-promises": "off",
      "object-curly-newline": "off",
      "no-plusplus": "off",
      "no-restricted-exports": "off",

      // Add these rules to match Prettier config and make sure we use double quotes
      quotes: ["error", "double"],
      "@typescript-eslint/quotes": ["error", "double"],

      "no-param-reassign": [
        "error",
        {
          props: true,
        },
      ],
    },
  },
];
