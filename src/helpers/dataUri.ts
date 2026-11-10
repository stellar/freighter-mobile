import { Buffer } from "buffer";

// `data:<mediatype>[;param...],` — group 1 is the media type, group 2 the
// parameters. The payload may itself contain commas, so only the first one
// ends the header.
const DATA_URI_HEADER = /^data:([^;,]*)((?:;[^;,]*)*),/i;

/*
 * Data URI payloads should be percent-encoded, but on-chain generators often
 * emit them raw (and inline SVG such as `width='100%'` makes the raw form
 * undecodable). Decode when we can, otherwise use the payload as written.
 */
const decodePercentEncoded = (payload: string) => {
  try {
    return decodeURIComponent(payload);
  } catch {
    return payload;
  }
};

/**
 * Decodes the text payload of a `data:` URI of the given media type, e.g.
 * `data:application/json,{"name":"..."}` or
 * `data:image/svg+xml;base64,PHN2Zy...`.
 *
 * Handles raw, percent-encoded and base64 payloads. Returns null when the
 * string is not a data URI of that media type.
 */
export const decodeDataUri = (uri: string, mediaType: string) => {
  const header = DATA_URI_HEADER.exec(uri);
  if (!header || header[1].trim().toLowerCase() !== mediaType) {
    return null;
  }

  const payload = uri.slice(header[0].length);

  return /;base64$/i.test(header[2])
    ? Buffer.from(payload.trim(), "base64").toString("utf-8")
    : decodePercentEncoded(payload);
};
