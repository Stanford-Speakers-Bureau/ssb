/**
 * Verifies AWS SNS HTTP(S) message signatures using only WebCrypto, so it
 * runs on Cloudflare Workers and in Bun tests without extra dependencies.
 *
 * https://docs.aws.amazon.com/sns/latest/dg/sns-verify-signature-of-message.html
 */

export type SnsMessage = {
  Type: "Notification" | "SubscriptionConfirmation" | "UnsubscribeConfirmation";
  MessageId: string;
  TopicArn: string;
  Message: string;
  Timestamp: string;
  SignatureVersion: string;
  Signature: string;
  SigningCertURL: string;
  Subject?: string;
  SubscribeURL?: string;
  Token?: string;
};

const SNS_HOST_RE = /^sns\.[a-z0-9-]+\.amazonaws\.com(\.cn)?$/;

/** True for https URLs on an official SNS host (e.g. sns.us-east-2.amazonaws.com). */
export function isSnsUrl(
  value: string | undefined,
  pathSuffix?: string,
): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !SNS_HOST_RE.test(url.hostname)) {
      return false;
    }
    return pathSuffix ? url.pathname.endsWith(pathSuffix) : true;
  } catch {
    return false;
  }
}

export function parseSnsMessage(raw: unknown): SnsMessage | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  const str = (k: string) => typeof m[k] === "string";
  if (
    !str("Type") ||
    !str("MessageId") ||
    !str("TopicArn") ||
    !str("Message") ||
    !str("Timestamp") ||
    !str("SignatureVersion") ||
    !str("Signature") ||
    !str("SigningCertURL")
  ) {
    return null;
  }
  if (
    m.Type !== "Notification" &&
    m.Type !== "SubscriptionConfirmation" &&
    m.Type !== "UnsubscribeConfirmation"
  ) {
    return null;
  }
  return m as unknown as SnsMessage;
}

/** Builds the exact string AWS signed, per message type. */
export function buildStringToSign(msg: SnsMessage): string {
  const keys =
    msg.Type === "Notification"
      ? ["Message", "MessageId", "Subject", "Timestamp", "TopicArn", "Type"]
      : [
          "Message",
          "MessageId",
          "SubscribeURL",
          "Timestamp",
          "Token",
          "TopicArn",
          "Type",
        ];
  let out = "";
  for (const key of keys) {
    const value = (msg as Record<string, string | undefined>)[key];
    if (value === undefined) {
      if (key === "Subject") continue; // Subject is optional on notifications
      throw new Error(`SNS message missing ${key}`);
    }
    out += `${key}\n${value}\n`;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Minimal DER reader: just enough to pull SubjectPublicKeyInfo out of an
// X.509 certificate so WebCrypto can import it as "spki".
// ---------------------------------------------------------------------------

type Tlv = { tag: number; start: number; contentStart: number; end: number };

function readTlv(buf: Uint8Array, offset: number): Tlv {
  const tag = buf[offset];
  let pos = offset + 1;
  let len = buf[pos++];
  if (len & 0x80) {
    const n = len & 0x7f;
    if (n === 0 || n > 4) throw new Error("Unsupported DER length");
    len = 0;
    for (let i = 0; i < n; i++) len = (len << 8) | buf[pos++];
  }
  const end = pos + len;
  if (end > buf.length) throw new Error("DER length out of range");
  return { tag, start: offset, contentStart: pos, end };
}

export function extractSpkiFromCertDer(der: Uint8Array): Uint8Array {
  const cert = readTlv(der, 0);
  const tbs = readTlv(der, cert.contentStart);
  let pos = tbs.contentStart;
  // Optional [0] EXPLICIT version
  if (der[pos] === 0xa0) pos = readTlv(der, pos).end;
  // serialNumber, signature, issuer, validity, subject
  for (let i = 0; i < 5; i++) pos = readTlv(der, pos).end;
  const spki = readTlv(der, pos);
  if (spki.tag !== 0x30) throw new Error("Unexpected SPKI tag");
  return der.slice(spki.start, spki.end);
}

function pemToDer(pem: string): Uint8Array {
  const match = pem.match(
    /-----BEGIN CERTIFICATE-----([\s\S]+?)-----END CERTIFICATE-----/,
  );
  if (!match) throw new Error("No certificate found in PEM");
  return Uint8Array.from(atob(match[1].replace(/\s+/g, "")), (c) =>
    c.charCodeAt(0),
  );
}

function base64ToBytes(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

const certCache = new Map<string, Promise<Uint8Array>>();

async function fetchSpki(certUrl: string): Promise<Uint8Array> {
  let cached = certCache.get(certUrl);
  if (!cached) {
    cached = (async () => {
      const res = await fetch(certUrl);
      if (!res.ok) throw new Error(`Cert fetch failed (${res.status})`);
      return extractSpkiFromCertDer(pemToDer(await res.text()));
    })();
    certCache.set(certUrl, cached);
    cached.catch(() => certCache.delete(certUrl));
  }
  return cached;
}

export type VerifyDeps = {
  /** Override for tests: returns the SPKI bytes for a cert URL. */
  getSpki?: (certUrl: string) => Promise<Uint8Array>;
};

export async function verifySnsSignature(
  msg: SnsMessage,
  deps: VerifyDeps = {},
): Promise<boolean> {
  if (!isSnsUrl(msg.SigningCertURL, ".pem")) return false;

  const hash =
    msg.SignatureVersion === "1"
      ? "SHA-1"
      : msg.SignatureVersion === "2"
        ? "SHA-256"
        : null;
  if (!hash) return false;

  try {
    const spki = await (deps.getSpki ?? fetchSpki)(msg.SigningCertURL);
    const key = await crypto.subtle.importKey(
      "spki",
      spki as BufferSource,
      { name: "RSASSA-PKCS1-v1_5", hash },
      false,
      ["verify"],
    );
    return await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      base64ToBytes(msg.Signature) as BufferSource,
      new TextEncoder().encode(buildStringToSign(msg)),
    );
  } catch (err) {
    console.error("[sns] Signature verification error:", err);
    return false;
  }
}
