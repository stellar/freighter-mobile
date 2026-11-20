import { Buffer } from "buffer";

// `data:<mediatype>[;param...],` — group 1 is the media type, group 2 the
// parameters. The payload may itself contain commas, so only the first one
// ends the header.
const DATA_URI_HEADER = /^data:([^;,]*)((?:;[^;,]*)*),/i;

// Payloads are not always valid percent-encoding, so fall back to the payload
// as written when decoding fails.
export const decodePercentEncoded = (payload: string) => {
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
 * Handles raw, percent-encoded and base64 payloads. A base64 payload is
 * percent-decoded first, as browsers do. Pass `percentDecode: false` to get a
 * text payload as written. Returns null when the string is not a data URI of
 * that media type.
 */
export const decodeDataUri = (
  uri: string,
  mediaType: string,
  { percentDecode = true }: { percentDecode?: boolean } = {},
) => {
  const header = DATA_URI_HEADER.exec(uri);
  if (!header || header[1].trim().toLowerCase() !== mediaType) {
    return null;
  }

  const payload = uri.slice(header[0].length);

  if (/;base64$/i.test(header[2])) {
    return Buffer.from(decodePercentEncoded(payload).trim(), "base64").toString(
      "utf-8",
    );
  }

  return percentDecode ? decodePercentEncoded(payload) : payload;
};
