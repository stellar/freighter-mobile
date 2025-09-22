/**
 * Intl Polyfill for React Native
 *
 * This polyfill provides support for Intl.NumberFormat
 * which are not available in React Native's JavaScript engine (Hermes/JSC) on iOS.
 *
 * IMPORTANT: Keep order as-is.
 * 1st import: @formatjs/intl-getcanonicallocales/polyfill
 * 2nd import: @formatjs/intl-locale/polyfill
 * 3rd import: @formatjs/intl-pluralrules/polyfill / displayNames / listFormat
 * 4th import numberFormat
 * 5th import datetimeformat / relativeTimeFormat
 */

// essential imports
import "@formatjs/intl-getcanonicallocales/polyfill";
import "@formatjs/intl-locale/polyfill";

// needed for numberformat, but locale-dependent
import "@formatjs/intl-pluralrules/polyfill";
import "@formatjs/intl-pluralrules/locale-data/en";
import "@formatjs/intl-pluralrules/locale-data/pt";

import "@formatjs/intl-numberformat/polyfill";
import "@formatjs/intl-numberformat/locale-data/en";
import "@formatjs/intl-numberformat/locale-data/pt";

// Additional iOS-specific configuration
if (typeof global !== "undefined") {
  // Ensure Intl is available globally
  if (!global.Intl) {
    global.Intl = Intl;
  }
}
