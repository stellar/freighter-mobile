/* eslint-disable global-require */
import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        gray: {
          1: "var(--color-gray-1)",
          2: "var(--color-gray-2)",
          3: "var(--color-gray-3)",
          4: "var(--color-gray-4)",
          5: "var(--color-gray-5)",
          6: "var(--color-gray-6)",
          7: "var(--color-gray-7)",
          8: "var(--color-gray-8)",
          9: "var(--color-gray-9)",
          10: "var(--color-gray-10)",
          11: "var(--color-gray-11)",
          12: "var(--color-gray-12)",
        },
        lilac: {
          1: "var(--color-lilac-1)",
          2: "var(--color-lilac-2)",
          3: "var(--color-lilac-3)",
          4: "var(--color-lilac-4)",
          5: "var(--color-lilac-5)",
          6: "var(--color-lilac-6)",
          7: "var(--color-lilac-7)",
          8: "var(--color-lilac-8)",
          9: "var(--color-lilac-9)",
          10: "var(--color-lilac-10)",
          11: "var(--color-lilac-11)",
          12: "var(--color-lilac-12)",
        },
        base: {
          0: "var(--color-base-0)",
          1: "var(--color-base-1)",
        },
        overlay: {
          1: "var(--color-overlay-1)",
          2: "var(--color-overlay-2)",
          3: "var(--color-overlay-3)",
          4: "var(--color-overlay-4)",
          5: "var(--color-overlay-5)",
          6: "var(--color-overlay-6)",
          7: "var(--color-overlay-7)",
          8: "var(--color-overlay-8)",
          9: "var(--color-overlay-9)",
          10: "var(--color-overlay-10)",
        },
        green: {
          1: "var(--color-green-1)",
          2: "var(--color-green-2)",
          3: "var(--color-green-3)",
          4: "var(--color-green-4)",
          5: "var(--color-green-5)",
          6: "var(--color-green-6)",
          7: "var(--color-green-7)",
          8: "var(--color-green-8)",
          9: "var(--color-green-9)",
          10: "var(--color-green-10)",
          11: "var(--color-green-11)",
          12: "var(--color-green-12)",
        },
        amber: {
          1: "var(--color-amber-1)",
          2: "var(--color-amber-2)",
          3: "var(--color-amber-3)",
          4: "var(--color-amber-4)",
          5: "var(--color-amber-5)",
          6: "var(--color-amber-6)",
          7: "var(--color-amber-7)",
          8: "var(--color-amber-8)",
          9: "var(--color-amber-9)",
          10: "var(--color-amber-10)",
          11: "var(--color-amber-11)",
          12: "var(--color-amber-12)",
        },
        red: {
          1: "var(--color-red-1)",
          2: "var(--color-red-2)",
          3: "var(--color-red-3)",
          4: "var(--color-red-4)",
          5: "var(--color-red-5)",
          6: "var(--color-red-6)",
          7: "var(--color-red-7)",
          8: "var(--color-red-8)",
          9: "var(--color-red-9)",
          10: "var(--color-red-10)",
          11: "var(--color-red-11)",
          12: "var(--color-red-12)",
        },
        white: "var(--color-white)",
        gold: {
          1: "var(--color-gold-1)",
          2: "var(--color-gold-2)",
          3: "var(--color-gold-3)",
          4: "var(--color-gold-4)",
          5: "var(--color-gold-5)",
          6: "var(--color-gold-6)",
          7: "var(--color-gold-7)",
          8: "var(--color-gold-8)",
          9: "var(--color-gold-9)",
          10: "var(--color-gold-10)",
          11: "var(--color-gold-11)",
          12: "var(--color-gold-12)",
        },
        navy: {
          1: "var(--color-navy-1)",
          2: "var(--color-navy-2)",
          3: "var(--color-navy-3)",
          4: "var(--color-navy-4)",
          5: "var(--color-navy-5)",
          6: "var(--color-navy-6)",
          7: "var(--color-navy-7)",
          8: "var(--color-navy-8)",
          9: "var(--color-navy-9)",
          10: "var(--color-navy-10)",
          11: "var(--color-navy-11)",
          12: "var(--color-navy-12)",
        },
        teal: {
          1: "var(--color-teal-1)",
          2: "var(--color-teal-2)",
          3: "var(--color-teal-3)",
          4: "var(--color-teal-4)",
          5: "var(--color-teal-5)",
          6: "var(--color-teal-6)",
          7: "var(--color-teal-7)",
          8: "var(--color-teal-8)",
          9: "var(--color-teal-9)",
          10: "var(--color-teal-10)",
          11: "var(--color-teal-11)",
          12: "var(--color-teal-12)",
        },
        mint: {
          1: "var(--color-mint-1)",
          2: "var(--color-mint-2)",
          3: "var(--color-mint-3)",
          4: "var(--color-mint-4)",
          5: "var(--color-mint-5)",
          6: "var(--color-mint-6)",
          7: "var(--color-mint-7)",
          8: "var(--color-mint-8)",
          9: "var(--color-mint-9)",
          10: "var(--color-mint-10)",
          11: "var(--color-mint-11)",
          12: "var(--color-mint-12)",
        },
        lime: {
          1: "var(--color-lime-1)",
          2: "var(--color-lime-2)",
          3: "var(--color-lime-3)",
          4: "var(--color-lime-4)",
          5: "var(--color-lime-5)",
          6: "var(--color-lime-6)",
          7: "var(--color-lime-7)",
          8: "var(--color-lime-8)",
          9: "var(--color-lime-9)",
          10: "var(--color-lime-10)",
          11: "var(--color-lime-11)",
          12: "var(--color-lime-12)",
        },
        pink: {
          1: "var(--color-pink-1)",
          2: "var(--color-pink-2)",
          3: "var(--color-pink-3)",
          4: "var(--color-pink-4)",
          5: "var(--color-pink-5)",
          6: "var(--color-pink-6)",
          7: "var(--color-pink-7)",
          8: "var(--color-pink-8)",
          9: "var(--color-pink-9)",
          10: "var(--color-pink-10)",
          11: "var(--color-pink-11)",
          12: "var(--color-pink-12)",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
