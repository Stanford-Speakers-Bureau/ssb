import { describe, expect, test } from "bun:test";
import { createPublicKey, createSign, generateKeyPairSync } from "node:crypto";
import {
  buildStringToSign,
  extractSpkiFromCertDer,
  isSnsUrl,
  parseSnsMessage,
  verifySnsSignature,
  type SnsMessage,
} from "../sns-verify";

// Fresh keypair per run, so no private key lives in the repo.
const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
const spkiDer = new Uint8Array(
  publicKey.export({ type: "spki", format: "der" }),
);

// Public self-signed cert (CN=sns-test-only), used only to test DER parsing.
const TEST_CERT_PEM = `-----BEGIN CERTIFICATE-----
MIIDEzCCAfugAwIBAgIUQ2CTQ//N8KqwboL04fSblqdrzWYwDQYJKoZIhvcNAQEL
BQAwGDEWMBQGA1UEAwwNc25zLXRlc3Qtb25seTAgFw0yNjExMDIxOTA4MTdaGA8y
MTI2MTAwOTE5MDgxN1owGDEWMBQGA1UEAwwNc25zLXRlc3Qtb25seTCCASIwDQYJ
KoZIhvcNAQEBBQADggEPADCCAQoCggEBALvAorIKKUYVOLzOfZrMHe8GAAD3LBCg
/vL/QcTG6xdC3I9Mku4GtJV1hLtqRlfv+KJPuPgw+zoHEqsVgwboIbgSHMNmWQ7R
JO4/YNQyforDSKJ2GzWcYyGIRCFHGwMt2E7jvWL+N7ZepVEBPAJi+daC/uU2HRkI
zHcx8nvt1fOre+LsXszUDGFAHxHrf9MI57waA7/M71Lj2Dz8A1anRLMxJhJDCQgi
PsKmiyw3lyAD86hOEpOXUdZa7nKTsh5iHTxX3qHwyN0RG2khYE3vIKFJO0NQ0ovJ
4xhIlHIgrEZGJ5lIWs10FkUTD20B9WGJWLhnJhjj7z85Gt0pqJe0HfkCAwEAAaNT
MFEwHQYDVR0OBBYEFEZt3EyO0QKZom72O+E2aJqu/bBAMB8GA1UdIwQYMBaAFEZt
3EyO0QKZom72O+E2aJqu/bBAMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQEL
BQADggEBAHPp43/WWl0Zg/7lXh2kboJlUGt63KgNON2tGEg5o+VE8i5PAHpbExsn
JQMCFQiGUSKqWbo9WRJQ/+wtqNFk2YaANFESjpGQDVXBQF84vrCsIkHX+DQYDn1C
cXHkuz27Hiapj0wsvdS3P6D8OE3ZW6kaNcsaz2K7iMkVfUNsASUDmDCDf383WRn7
csjJ6klo3Wq3u4g0XZYR4EcE7NKKkuadViQZZOSHODaAjh9bDebVEckM54vwScYM
/BnqxXlVJXHeWVpXSsp+9iUWwY5f0QvZRd6SmxVleoRnGd24bkO+4j+t5r0sefyg
C1kF0B1YcmWyJGhWMry7fMHTNv0rNKY=
-----END CERTIFICATE-----`;

const CERT_URL =
  "https://sns.us-east-2.amazonaws.com/SimpleNotificationService-abc.pem";

const getSpki = async () => spkiDer;

function sign(msg: Omit<SnsMessage, "Signature">): SnsMessage {
  const algo = msg.SignatureVersion === "1" ? "RSA-SHA1" : "RSA-SHA256";
  const signer = createSign(algo);
  signer.update(buildStringToSign(msg as SnsMessage));
  return { ...msg, Signature: signer.sign(privateKey, "base64") };
}

function notification(overrides: Partial<SnsMessage> = {}) {
  return sign({
    Type: "Notification",
    MessageId: "m-1",
    TopicArn: "arn:aws:sns:us-east-2:123456789012:ses-feedback",
    Message: JSON.stringify({ notificationType: "Bounce" }),
    Timestamp: "2026-11-02T18:51:00.000Z",
    SignatureVersion: "2",
    SigningCertURL: CERT_URL,
    ...overrides,
  });
}

describe("verifySnsSignature", () => {
  test("accepts a correctly signed SHA-256 notification", async () => {
    expect(await verifySnsSignature(notification(), { getSpki })).toBe(true);
  });

  test("accepts SignatureVersion 1 (SHA-1)", async () => {
    const msg = notification({ SignatureVersion: "1" });
    expect(await verifySnsSignature(msg, { getSpki })).toBe(true);
  });

  test("accepts notifications with a Subject", async () => {
    const msg = notification({ Subject: "hello" });
    expect(await verifySnsSignature(msg, { getSpki })).toBe(true);
  });

  test("accepts a signed SubscriptionConfirmation", async () => {
    const msg = sign({
      Type: "SubscriptionConfirmation",
      MessageId: "m-2",
      TopicArn: "arn:aws:sns:us-east-2:123456789012:ses-feedback",
      Message: "You have chosen to subscribe...",
      Timestamp: "2026-11-02T18:51:00.000Z",
      SignatureVersion: "2",
      SigningCertURL: CERT_URL,
      SubscribeURL:
        "https://sns.us-east-2.amazonaws.com/?Action=ConfirmSubscription",
      Token: "tok",
    });
    expect(await verifySnsSignature(msg, { getSpki })).toBe(true);
  });

  test("rejects a tampered message body", async () => {
    const msg = notification();
    msg.Message = JSON.stringify({ notificationType: "Complaint" });
    expect(await verifySnsSignature(msg, { getSpki })).toBe(false);
  });

  test("rejects a tampered topic", async () => {
    const msg = notification();
    msg.TopicArn = "arn:aws:sns:us-east-2:999999999999:evil";
    expect(await verifySnsSignature(msg, { getSpki })).toBe(false);
  });

  test("rejects a cert URL that isn't on an SNS host", async () => {
    const msg = notification({
      SigningCertURL: "https://evil.example.com/cert.pem",
    });
    expect(await verifySnsSignature(msg, { getSpki })).toBe(false);
  });

  test("rejects unknown signature versions", async () => {
    const msg = { ...notification(), SignatureVersion: "3" };
    expect(await verifySnsSignature(msg, { getSpki })).toBe(false);
  });
});

describe("extractSpkiFromCertDer", () => {
  test("matches Node's own SPKI extraction", () => {
    const der = Buffer.from(
      TEST_CERT_PEM.replace(/-----[^-]+-----/g, "").replace(/\s+/g, ""),
      "base64",
    );
    const ours = Buffer.from(extractSpkiFromCertDer(new Uint8Array(der)));
    const node = createPublicKey(TEST_CERT_PEM).export({
      type: "spki",
      format: "der",
    });
    expect(ours.equals(node)).toBe(true);
  });
});

describe("isSnsUrl", () => {
  test.each([
    ["https://sns.us-east-2.amazonaws.com/x.pem", true],
    ["https://sns.cn-north-1.amazonaws.com.cn/x.pem", true],
    ["http://sns.us-east-2.amazonaws.com/x.pem", false],
    ["https://sns.us-east-2.amazonaws.com.evil.com/x.pem", false],
    ["https://evilsns.us-east-2.amazonaws.com/x.pem", false],
    ["not a url", false],
  ])("%s -> %p", (url, expected) => {
    expect(isSnsUrl(url, ".pem")).toBe(expected);
  });
});

describe("parseSnsMessage", () => {
  test("rejects objects missing required fields", () => {
    expect(parseSnsMessage({ Type: "Notification" })).toBeNull();
    expect(parseSnsMessage(null)).toBeNull();
  });

  test("rejects unknown types", () => {
    expect(parseSnsMessage({ ...notification(), Type: "Other" })).toBeNull();
  });
});
