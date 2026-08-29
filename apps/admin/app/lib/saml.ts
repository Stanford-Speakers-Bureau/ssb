import { SAML, ValidateInResponseTo } from "@node-saml/node-saml";
import type { CacheProvider } from "@node-saml/node-saml/lib/types";
import {
  SAML_REQUEST_STATE_TTL_MS,
  getSamlRequestId,
  removeSamlRequestId,
  saveSamlRequestId,
} from "./session";

const DEFAULT_BASE_URL = "http://localhost:3001";

// Stanford IdP certificate — fetched from https://login.stanford.edu/idp.crt
const STANFORD_IDP_CERT = `MIIDnzCCAoegAwIBAgIJAJl9YtyaxKsZMA0GCSqGSIb3DQEBBQUAMGYxCzAJBgNV
BAYTAlVTMRMwEQYDVQQIDApDYWxpZm9ybmlhMREwDwYDVQQHDAhTdGFuZm9yZDEU
MBIGA1UECgwLSVQgU2VydmljZXMxGTAXBgNVBAMMEGlkcC5zdGFuZm9yZC5lZHUw
HhcNMTMwNDEwMTYzMTAwWhcNMzMwNDEwMTYzMTAwWjBmMQswCQYDVQQGEwJVUzET
MBEGA1UECAwKQ2FsaWZvcm5pYTERMA8GA1UEBwwIU3RhbmZvcmQxFDASBgNVBAoM
C0lUIFNlcnZpY2VzMRkwFwYDVQQDDBBpZHAuc3RhbmZvcmQuZWR1MIIBIjANBgkq
hkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAm6466Bd6mDwNOR2qZZy1WRZdjyrG2/xW
amGEMekg38fyuoSCIiMcgeA9UIUbiRCpAN87yI9HPcgDEdrmCK3Ena3J2MdFZbRE
b6fdRt76K+0FSl/CnyW9xaIlAhldXKbsgUDei3Xf/9P8H9Dxkk+PWd9Ha1RZ9Viz
dOLe2S2iDKc1CJg2kdGQTuQu6mUEGrB9WJmrLHJS7GkGDqy96owFjRL/p0i9KBdR
kgWG+GFHWkxzeNQ99yrQra3+C9FQXa/xLCdOY+BGOsAG7ej4094NZXRNTyXui4jR
WCm2GVdIVl7YB9++XSntS7zQEJ9QBnC1D4bS0tljMfdOGAvdUuJY7QIDAQABo1Aw
TjAdBgNVHQ4EFgQUJk4zcQ4JupEcAp0gEkob4YRDkckwHwYDVR0jBBgwFoAUJk4z
cQ4JupEcAp0gEkob4YRDkckwDAYDVR0TBAUwAwEB/zANBgkqhkiG9w0BAQUFAAOC
AQEAKvf9AO4+osJZOmkv6AVhNPm6JKoBSm9dr9NhwpSS5fpro6PrIjDZDLh/L5d/
+CQTDzuVsw3xwDtlm89lrzbqw5rSa2+ghJk79ijysSC0zOcD6ka9c17zauCNmFx9
lj9iddUw3aYHQcQRktWL8pvI2WCY6lTU+ouNM+owStya7umZ9rBdjg/fQerzaQxF
T0yV3tYEonL3hXMzSqZxWirwsyZ0TnhWJsgEnqqG9tCFAcFu2p+glwXn1WL2GCRv
BfuJMPzg7ZB419AEoeYnLktqAWiU+ISnVfbwFOJ+OM/O7VQOeHDm2AeYcwo12CAc
4GC9KWTs3QtS3GREPKYDlHRNxQ==`;

type MultiValue = string | string[] | undefined;

function getBaseUrl(request?: Request): string {
  if (process.env.NEXT_PUBLIC_ROOT_URL) {
    return process.env.NEXT_PUBLIC_ROOT_URL;
  }

  if (request?.url) {
    return new URL(request.url).origin;
  }

  return DEFAULT_BASE_URL;
}

function getPrivateKey(): string {
  return (process.env.SP_PRIVATE_KEY || "").replace(/\\n/g, "\n");
}

function getPublicCert(): string {
  return (process.env.SP_PUBLIC_CERT || "").replace(/\\n/g, "\n");
}

function getSingleValue(value: MultiValue): string {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

function getArrayValue(value: MultiValue): string[] {
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [value] : [];
}

export function stripPemHeaders(pem: string): string {
  return pem
    .replace(/-----BEGIN [A-Z ]+-----/g, "")
    .replace(/-----END [A-Z ]+-----/g, "")
    .replace(/\s/g, "");
}

export function normalizeCertificatePem(certificate: string): string {
  const trimmed = certificate.trim().replace(/\\n/g, "\n");

  if (!trimmed) {
    return "";
  }

  if (trimmed.includes("-----BEGIN CERTIFICATE-----")) {
    return trimmed;
  }

  const base64Body = trimmed.replace(/\s/g, "");
  const wrappedBody = base64Body.match(/.{1,64}/g)?.join("\n") ?? base64Body;

  return `-----BEGIN CERTIFICATE-----\n${wrappedBody}\n-----END CERTIFICATE-----`;
}

function createSamlRequestCacheProvider(): CacheProvider {
  return {
    saveAsync: saveSamlRequestId,
    getAsync: getSamlRequestId,
    removeAsync: removeSamlRequestId,
  };
}

export function createSamlClient(request?: Request) {
  const baseUrl = getBaseUrl(request);
  const issuer = process.env.SAML_SP_ENTITY_ID || baseUrl;

  return new SAML({
    entryPoint: "https://login.stanford.edu/idp/profile/SAML2/Redirect/SSO",
    issuer,
    callbackUrl: `${baseUrl}/api/auth/callback`,
    idpCert: normalizeCertificatePem(STANFORD_IDP_CERT),
    privateKey: getPrivateKey(),
    decryptionPvk: getPrivateKey(),
    signatureAlgorithm: "sha256",
    identifierFormat: "urn:oasis:names:tc:SAML:2.0:nameid-format:transient",
    wantAssertionsSigned: true,
    wantAuthnResponseSigned: true,
    maxAssertionAgeMs: 300_000, // 5 minutes
    acceptedClockSkewMs: 5000,
    validateInResponseTo: ValidateInResponseTo.always,
    requestIdExpirationPeriodMs: SAML_REQUEST_STATE_TTL_MS,
    cacheProvider: createSamlRequestCacheProvider(),
    logoutUrl: "https://login.stanford.edu/idp/profile/Logout",
  });
}

export async function generateMetadata(request?: Request): Promise<string> {
  const certData = stripPemHeaders(getPublicCert());
  return createSamlClient(request).generateServiceProviderMetadata(
    certData,
    certData,
  );
}

export type StanfordSamlAttributes = {
  uid: string;
  displayName: string;
  email: string;
  eduPersonAffiliation: string[];
  eduPersonScopedAffiliation: string[];
};

export function mapSamlAttributes(
  profile: Record<string, unknown>,
): StanfordSamlAttributes {
  const uid = getSingleValue(
    (profile["urn:oid:0.9.2342.19200300.100.1.1"] as MultiValue) ||
      (profile.uid as MultiValue),
  );
  const displayName = getSingleValue(
    (profile["urn:oid:2.16.840.1.113730.3.1.241"] as MultiValue) ||
      (profile.displayName as MultiValue),
  );
  const email = getSingleValue(
    (profile["urn:oid:0.9.2342.19200300.100.1.3"] as MultiValue) ||
      (profile.mail as MultiValue),
  );

  return {
    uid,
    displayName,
    email,
    eduPersonAffiliation: getArrayValue(
      (profile["urn:oid:1.3.6.1.4.1.5923.1.1.1.1"] as MultiValue) ||
        (profile.eduPersonAffiliation as MultiValue),
    ),
    eduPersonScopedAffiliation: getArrayValue(
      (profile["urn:oid:1.3.6.1.4.1.5923.1.1.1.9"] as MultiValue) ||
        (profile.eduPersonScopedAffiliation as MultiValue),
    ),
  };
}
