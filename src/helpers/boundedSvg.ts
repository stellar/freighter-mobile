/** Largest SVG icon, in characters of text, that is downloaded and drawn. */
export const MAX_SVG_BYTES = 100 * 1024;

/** Most elements an SVG icon may have. */
export const MAX_SVG_ELEMENTS = 2_000;

/** How long an SVG icon download may take, in milliseconds. */
export const SVG_FETCH_TIMEOUT_MS = 5_000;

/**
 * Elements a plain icon needs. Anything else (`use`, `image`, `pattern`,
 * `filter`, `foreignObject`, …) can make a small file costly to draw or pull
 * in more content, so an icon that uses it is shown as initials instead.
 */
const ALLOWED_SVG_ELEMENTS = new Set([
  "svg",
  "g",
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "defs",
  "linearGradient",
  "radialGradient",
  "stop",
  "clipPath",
  "mask",
  "title",
  "desc",
  "metadata",
  "text",
  "tspan",
  "style",
]);

/**
 * Whether an SVG's text is a plain icon that is cheap to draw: at most
 * MAX_SVG_BYTES long and MAX_SVG_ELEMENTS elements, with no DOCTYPE or entity
 * declaration, and only allowed elements.
 */
export const isRenderableSvg = (text: string): boolean => {
  if (text.length > MAX_SVG_BYTES) {
    return false;
  }

  if (/<!(DOCTYPE|ENTITY)/i.test(text)) {
    return false;
  }

  const elements = text.match(/<[A-Za-z][\w:.-]*/g) ?? [];
  if (elements.length > MAX_SVG_ELEMENTS) {
    return false;
  }

  return elements.every((tag) => ALLOWED_SVG_ELEMENTS.has(tag.slice(1)));
};

/**
 * Downloads a remote SVG icon with a hard size cap and a timeout, and returns
 * its text only if it is a plain icon (see isRenderableSvg). Only `https:`
 * URLs are fetched. The download is aborted as soon as it passes
 * MAX_SVG_BYTES, so an oversized file is never held in memory in full.
 *
 * @param url - The icon's URL
 * @returns The SVG text, or null when it can't be drawn safely
 */
export const fetchBoundedSvg = (url: string): Promise<string | null> =>
  new Promise((resolve) => {
    if (!url.toLowerCase().startsWith("https://")) {
      resolve(null);
      return;
    }

    let settled = false;
    const finish = (value: string | null) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };

    const request = new XMLHttpRequest();
    request.open("GET", url);
    request.responseType = "text";
    request.timeout = SVG_FETCH_TIMEOUT_MS;
    request.onprogress = (event) => {
      // For text responses React Native on Android reports a stale `loaded`
      // (0, or -1 for a decompressed body), so the text received so far counts too.
      if (Math.max(event.loaded, request.responseText.length) > MAX_SVG_BYTES) {
        request.abort();
        finish(null);
      }
    };
    request.onload = () => {
      const text = request.status === 200 ? request.responseText : "";
      finish(text && isRenderableSvg(text) ? text : null);
    };
    request.onerror = () => finish(null);
    request.ontimeout = () => finish(null);
    request.onabort = () => finish(null);
    request.send();
  });
