import { describe, expect, it } from "bun:test";

import {
  mapSamlAttributes,
  normalizeCertificatePem,
  stripPemHeaders,
} from "../saml";

describe("SAML helpers", () => {
  it("normalizes bare and escaped PEM certificates", () => {
    expect(normalizeCertificatePem("YWJj")).toBe(
      "-----BEGIN CERTIFICATE-----\nYWJj\n-----END CERTIFICATE-----",
    );
    expect(
      normalizeCertificatePem(
        "-----BEGIN CERTIFICATE-----\\nYWJj\\n-----END CERTIFICATE-----",
      ),
    ).toContain("-----BEGIN CERTIFICATE-----\nYWJj\n");
    expect(normalizeCertificatePem("   ")).toBe("");
  });

  it("removes certificate framing for service-provider metadata", () => {
    expect(
      stripPemHeaders(
        "-----BEGIN CERTIFICATE-----\nYW Jj\n-----END CERTIFICATE-----",
      ),
    ).toBe("YWJj");
  });

  it("prefers Stanford OID attributes and filters empty array values", () => {
    expect(
      mapSamlAttributes({
        uid: "fallback",
        "urn:oid:0.9.2342.19200300.100.1.1": ["oid-user", "ignored"],
        "urn:oid:2.16.840.1.113730.3.1.241": "OID User",
        "urn:oid:0.9.2342.19200300.100.1.3": "oid@stanford.edu",
        "urn:oid:1.3.6.1.4.1.5923.1.1.1.1": ["student", ""],
        "urn:oid:1.3.6.1.4.1.5923.1.1.1.9": "student@stanford.edu",
      }),
    ).toEqual({
      uid: "oid-user",
      displayName: "OID User",
      email: "oid@stanford.edu",
      eduPersonAffiliation: ["student"],
      eduPersonScopedAffiliation: ["student@stanford.edu"],
    });
  });
});
