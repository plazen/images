import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 12;

let KEY: Buffer;
if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length !== 64) {
  console.error(
    "ENCRYPTION_KEY is not set or is not a 64-character hex string."
  );
  KEY = Buffer.alloc(32);
} else {
  KEY = Buffer.from(process.env.ENCRYPTION_KEY, "hex");
}

/**
 * Encrypts a plaintext string.
 * @param text The plaintext string to encrypt.
 * @returns A string in the format "iv:authTag:content" or the original text if encryption fails.
 */
export function encrypt(text: string): string {
  if (!text) return text;
  if (!KEY) {
    console.error("Encryption key is not available.");
    return text;
  }

  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);

    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag().toString("hex");

    return `${iv.toString("hex")}:${authTag}:${encrypted}`;
  } catch (error) {
    console.error("Encryption failed:", error);
    return text;
  }
}

/**
 * Decrypts an encrypted hash.
 * @param hash The encrypted string in "iv:authTag:content" format.
 * @returns The decrypted plaintext string, or the original hash if decryption fails.
 */
export function decrypt(hash: string): string {
  if (!hash) return hash;
  if (!KEY) {
    console.error("Decryption key is not available.");
    return "[Key Error]";
  }

  try {
    const parts = hash.split(":");

    if (parts.length !== 3) {
      return hash;
    }

    const [ivHex, authTagHex, encryptedText] = parts;

    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");

    if (iv.length !== IV_LENGTH) {
      console.warn(
        `Decryption failed: Invalid IV length. Expected ${IV_LENGTH}, got ${iv.length}.`
      );
      return hash;
    }

    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    console.warn("Decryption failed, returning original text.");
    return hash;
  }
}
