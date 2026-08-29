import { describe, expect, it } from "bun:test";

import {
  mapSamlAttributes,
  normalizeCertificatePem,
  stripPemHeaders,
} from "../saml";

describe("SAML helpers", () => {
  it("wraps bare certificate data and expands escaped newlines", () => {
    expect(normalizeCertificatePem("YWJjZGVm")).toBe(
      "-----BEGIN CERTIFICATE-----\nYWJjZGVm\n-----END CERTIFICATE-----",
    );
    expect(
      normalizeCertificatePem(
        "-----BEGIN CERTIFICATE-----\\nYWJj\\n-----END CERTIFICATE-----",
      ),
    ).toContain("-----BEGIN CERTIFICATE-----\nYWJj\n");
  });

  it("strips PEM framing for metadata", () => {
    expect(
      stripPemHeaders(
        "-----BEGIN CERTIFICATE-----\nYW Jj\n-----END CERTIFICATE-----",
      ),
    ).toBe("YWJj");
  });

  it("maps Stanford OID arrays and conventional fallback keys", () => {
    expect(
      mapSamlAttributes({
        uid: ["auser", "ignored"],
        displayName: "A User",
        mail: "auser@stanford.edu",
        eduPersonAffiliation: ["student", "member"],
        eduPersonScopedAffiliation: "student@stanford.edu",
      }),
    ).toEqual({
      uid: "auser",
      displayName: "A User",
      email: "auser@stanford.edu",
      eduPersonAffiliation: ["student", "member"],
      eduPersonScopedAffiliation: ["student@stanford.edu"],
    });
  });
});
