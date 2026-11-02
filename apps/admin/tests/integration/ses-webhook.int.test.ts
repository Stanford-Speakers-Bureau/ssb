import { afterAll, afterEach, describe, expect, test } from "bun:test";

import { mockModule } from "@/tests/helpers/scoped-module-mock";

import {
  cleanup,
  closeTestDatabase,
  getTestDatabase,
  grantRole,
  registerCleanup,
  testEmail,
} from "../helpers/factories";

class TestNextResponse extends Response {
  static json(body: unknown, init?: ResponseInit): TestNextResponse {
    const headers = new Headers(init?.headers);
    headers.set("content-type", "application/json");
    return new TestNextResponse(JSON.stringify(body), { ...init, headers });
  }
}

await mockModule("next/server", () => ({
  NextRequest: Request,
  NextResponse: TestNextResponse,
}));

// Signature checking is covered by sns-verify.test.ts. Here we only care
// that a verified notification ends up in the database.
let signatureValid = true;
const realSns = await import("@/app/lib/sns-verify");
await mockModule("@/app/lib/sns-verify", () => ({
  ...realSns,
  verifySnsSignature: async () => signatureValid,
}));

const TOPIC = "arn:aws:sns:us-east-2:123456789012:ses-feedback";

const integration =
  process.env.TEST_INTEGRATION === "1" ? describe : describe.skip;

function snsRequest(message: unknown, topic = TOPIC) {
  return new Request("http://localhost/api/webhooks/ses", {
    method: "POST",
    headers: { "content-type": "text/plain; charset=UTF-8" },
    body: JSON.stringify({
      Type: "Notification",
      MessageId: crypto.randomUUID(),
      TopicArn: topic,
      Message: JSON.stringify(message),
      Timestamp: new Date().toISOString(),
      SignatureVersion: "2",
      Signature: "sig",
      SigningCertURL: "https://sns.us-east-2.amazonaws.com/x.pem",
    }),
  });
}

function bounce(email: string, bounceType = "Permanent") {
  return {
    notificationType: "Bounce",
    mail: {
      messageId: "ses-1",
      commonHeaders: { subject: "Amanda Gorman is coming to Stanford!" },
    },
    bounce: {
      bounceType,
      bounceSubType: "General",
      bouncedRecipients: [
        { emailAddress: email, diagnosticCode: "smtp; 550 5.1.1 user unknown" },
      ],
    },
  };
}

async function rolesFor(email: string) {
  const sql = getTestDatabase();
  const rows =
    await sql`select roles from roles where email = ${email.toLowerCase()}`;
  return [...rows];
}

async function auditFor(email: string) {
  const sql = getTestDatabase();
  const rows = await sql`
    select action, actor, metadata from audit_logs
    where target_email = ${email.toLowerCase()}
    order by created_at
  `;
  return [...rows];
}

function trackCleanup(email: string) {
  const sql = getTestDatabase();
  registerCleanup(async () => {
    await sql`delete from roles where email = ${email}`;
    await sql`delete from audit_logs where target_email = ${email}`;
  });
}

integration("SES bounce webhook against Postgres", () => {
  process.env.SES_FEEDBACK_SNS_TOPIC_ARNS = TOPIC;
  const load = () => import("@/app/api/webhooks/ses/route");

  afterEach(async () => {
    signatureValid = true;
    await cleanup();
  });
  afterAll(closeTestDatabase);

  test("permanent bounce suppresses a new address and audits it", async () => {
    const email = testEmail("bounce");
    trackCleanup(email);
    const { POST } = await load();

    const res = await POST(snsRequest(bounce(email.toUpperCase())));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ suppressed: [email] });

    expect(await rolesFor(email)).toEqual([{ roles: "email_suppression" }]);

    const logs = await auditFor(email);
    expect(logs.map((l) => l.action).sort()).toEqual([
      "email.bounce",
      "user.add_role",
    ]);
    for (const l of logs) expect(l.actor).toBe("system:ses-feedback");
    const role = logs.find((l) => l.action === "user.add_role")!;
    expect(JSON.parse(role.metadata)).toMatchObject({
      role: "email_suppression",
      auto: true,
      reason: "bounce",
      subject: "Amanda Gorman is coming to Stanford!",
    });
    const bounceRow = logs.find((l) => l.action === "email.bounce")!;
    expect(JSON.parse(bounceRow.metadata)).toMatchObject({
      outcome: "suppressed",
      type: "Permanent/General",
      diagnostic: "smtp; 550 5.1.1 user unknown",
      subject: "Amanda Gorman is coming to Stanford!",
    });
  });

  test("appends to existing roles and is idempotent", async () => {
    const email = testEmail("bounce-existing");
    await grantRole(email, "fee_waiver");
    trackCleanup(email);
    const { POST } = await load();

    await POST(snsRequest(bounce(email)));
    const second = await POST(snsRequest(bounce(email)));
    expect(await second.json()).toMatchObject({
      suppressed: [],
      recipients: [{ email, outcome: "already_suppressed" }],
    });

    expect(await rolesFor(email)).toEqual([
      { roles: "fee_waiver,email_suppression" },
    ]);
    const logs = await auditFor(email);
    expect(logs.filter((l) => l.action === "user.add_role")).toHaveLength(1);
    expect(
      logs
        .filter((l) => l.action === "email.bounce")
        .map((l) => JSON.parse(l.metadata).outcome)
        .sort(),
    ).toEqual(["already_suppressed", "suppressed"]);
  });

  test("transient bounces are logged but don't suppress", async () => {
    const email = testEmail("bounce-transient");
    trackCleanup(email);
    const { POST } = await load();

    const res = await POST(snsRequest(bounce(email, "Transient")));
    expect(res.status).toBe(200);
    expect(await rolesFor(email)).toEqual([]);
    const logs = await auditFor(email);
    expect(logs.map((l) => l.action)).toEqual(["email.bounce"]);
    expect(JSON.parse(logs[0].metadata)).toMatchObject({
      outcome: "not_suppressed",
      type: "Transient/General",
    });
  });

  test("rejects unknown topics and bad signatures", async () => {
    const email = testEmail("bounce-forged");
    trackCleanup(email);
    const { POST } = await load();

    const wrongTopic = await POST(
      snsRequest(bounce(email), "arn:aws:sns:us-east-2:999:evil"),
    );
    expect(wrongTopic.status).toBe(403);

    signatureValid = false;
    const badSig = await POST(snsRequest(bounce(email)));
    expect(badSig.status).toBe(403);

    expect(await rolesFor(email)).toEqual([]);
    expect(await auditFor(email)).toEqual([]);
  });
});
