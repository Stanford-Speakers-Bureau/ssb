import { NextResponse } from "next/server";
import { logAuditEvent } from "@/app/lib/audit";
import { addEmailSuppressions } from "@/app/lib/email-suppression";
import { parseSesFeedback } from "@/app/lib/ses-feedback";
import {
  isSnsUrl,
  parseSnsMessage,
  verifySnsSignature,
} from "@/app/lib/sns-verify";

/**
 * SES bounce/complaint webhook.
 *
 * SES publishes Bounce and Complaint notifications to an SNS topic, and SNS
 * POSTs them here. Hard bounces and spam complaints add the recipient to the
 * `email_suppression` role so every future send skips them.
 *
 * Security: every message must carry a valid AWS signature AND come from a
 * topic listed in SES_FEEDBACK_SNS_TOPIC_ARNS. The topic check matters: any
 * AWS account can create its own topic and send correctly signed messages
 * to this URL.
 */

const ACTOR = "system:ses-feedback";

function allowedTopics(): Set<string> {
  return new Set(
    (process.env.SES_FEEDBACK_SNS_TOPIC_ARNS ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
  );
}

export async function POST(req: Request) {
  const topics = allowedTopics();
  if (topics.size === 0) {
    console.error("[ses-webhook] SES_FEEDBACK_SNS_TOPIC_ARNS is not set");
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  let raw: unknown;
  try {
    // SNS sends JSON with Content-Type: text/plain.
    raw = JSON.parse(await req.text());
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const msg = parseSnsMessage(raw);
  if (!msg) {
    return NextResponse.json({ error: "Not an SNS message" }, { status: 400 });
  }
  if (!topics.has(msg.TopicArn)) {
    console.warn(`[ses-webhook] Rejected unknown topic ${msg.TopicArn}`);
    return NextResponse.json({ error: "Unknown topic" }, { status: 403 });
  }
  if (!(await verifySnsSignature(msg))) {
    console.warn(`[ses-webhook] Bad signature for message ${msg.MessageId}`);
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  if (msg.Type === "SubscriptionConfirmation") {
    if (!isSnsUrl(msg.SubscribeURL)) {
      return NextResponse.json({ error: "Bad SubscribeURL" }, { status: 400 });
    }
    const res = await fetch(msg.SubscribeURL!);
    await res.body?.cancel();
    if (!res.ok) {
      console.error(
        `[ses-webhook] Subscription confirm failed (${res.status}) for ${msg.TopicArn}`,
      );
      await logAuditEvent({
        action: "email.ses_webhook",
        actor: ACTOR,
        metadata: {
          status: "subscription_confirm_failed",
          topic: msg.TopicArn,
          httpStatus: res.status,
        },
      });
      return NextResponse.json({ error: "Confirm failed" }, { status: 502 });
    }
    console.log(`[ses-webhook] Confirmed subscription to ${msg.TopicArn}`);
    await logAuditEvent({
      action: "email.ses_webhook",
      actor: ACTOR,
      metadata: { status: "subscription_confirmed", topic: msg.TopicArn },
    });
    return NextResponse.json({ ok: true, confirmed: true });
  }

  if (msg.Type === "UnsubscribeConfirmation") {
    console.warn(`[ses-webhook] Unsubscribed from ${msg.TopicArn}`);
    await logAuditEvent({
      action: "email.ses_webhook",
      actor: ACTOR,
      metadata: { status: "unsubscribed", topic: msg.TopicArn },
    });
    return NextResponse.json({ ok: true });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(msg.Message);
  } catch {
    // Not an SES notification (e.g. a manual test publish). Ack so SNS
    // doesn't retry it.
    return NextResponse.json({ ok: true, ignored: "non-JSON message" });
  }

  const feedback = parseSesFeedback(payload);
  if (feedback.kind === "other") {
    // Deliveries, sends, opens, etc. if someone enables them on the topic.
    return NextResponse.json({
      ok: true,
      ignored: feedback.otherType ?? "unknown",
    });
  }

  let newlySuppressed: string[];
  try {
    newlySuppressed = await addEmailSuppressions({
      actor: ACTOR,
      entries: feedback.recipients
        .filter((r) => r.suppress)
        .map((r) => ({
          email: r.email,
          metadata: {
            auto: true,
            reason: r.reason,
            type: r.type,
            diagnostic: r.diagnostic,
            subject: feedback.subject,
          },
        })),
    });
  } catch (err) {
    // 500 makes SNS retry later. Nothing has been logged yet, so a retry
    // won't create duplicate bounce rows.
    console.error("[ses-webhook] Failed to write suppressions:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  const added = new Set(newlySuppressed);
  const outcomes = feedback.recipients.map((r) => ({
    ...r,
    outcome: !r.suppress
      ? ("not_suppressed" as const)
      : added.has(r.email)
        ? ("suppressed" as const)
        : ("already_suppressed" as const),
  }));

  // One audit row per recipient, whether or not it was suppressed, so the
  // audit log shows every bounce/complaint SES reports.
  await Promise.all(
    outcomes.map((r) =>
      logAuditEvent({
        action: r.reason === "bounce" ? "email.bounce" : "email.complaint",
        actor: ACTOR,
        targetEmail: r.email,
        metadata: {
          outcome: r.outcome,
          type: r.type,
          diagnostic: r.diagnostic,
          subject: feedback.subject,
          sesMessageId: feedback.sesMessageId,
        },
      }),
    ),
  );

  for (const r of outcomes) {
    console.log(
      `[ses-webhook] ${r.reason} ${r.email} ${r.type} -> ${r.outcome}`,
    );
  }

  return NextResponse.json({
    ok: true,
    kind: feedback.kind,
    suppressed: newlySuppressed,
    recipients: outcomes.map(({ email, outcome }) => ({ email, outcome })),
  });
}
