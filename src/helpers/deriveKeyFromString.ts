const HASH_KEY_ENCRYPTION_PARAMS = { name: "PBKDF2", hash: "SHA-256" };
const TEMPORARY_STORE_ENCRYPTION_NAME = "AES-CBC";

export const deriveKeyFromString = async (str: string) => {
  const iterations = 1000;
  const keylen = 32;
  const keyLength = 48;
  // randomized salt will make sure the hashed password is different on every login
  const salt = crypto.getRandomValues(new Uint8Array(16)).toString();

  const encoder = new TextEncoder();
  const keyMaterial = encoder.encode(str);

  const importedKey = await crypto.subtle.importKey(
    "raw",
    keyMaterial,
    HASH_KEY_ENCRYPTION_PARAMS,
    false,
    ["deriveBits"],
  );

  const saltBuffer = encoder.encode(salt);
  const params = {
    ...HASH_KEY_ENCRYPTION_PARAMS,
    salt: saltBuffer,
    iterations,
  };
  const derivation = await crypto.subtle.deriveBits(
    params,
    importedKey,
    keyLength * 8,
  );

  const derivedKey = derivation.slice(0, keylen);
  const iv = derivation.slice(keylen);

  const importedEncryptionKey = await crypto.subtle.importKey(
    "raw",
    derivedKey,
    { name: TEMPORARY_STORE_ENCRYPTION_NAME },
    true,
    ["encrypt", "decrypt"],
  );

  return {
    key: importedEncryptionKey,
    iv,
  };
};
