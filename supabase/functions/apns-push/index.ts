/// <reference lib="deno.ns" />
/// <reference lib="deno.unstable" />
// Apple Wallet pass-update push sender.
//
// Why this runs on Supabase (Deno) and not in the Cloudflare Worker:
// APNs requires an HTTP/2 connection with mTLS client-cert auth. Workers can't
// reliably negotiate that; Deno's `Deno.createHttpClient({ cert, key })` + fetch
// can. We authenticate with the existing Pass Type ID certificate (the same one
// that signs the passes) — no separate APNs Auth Key needed.
//
// Input  (POST JSON): { serialNumbers: string[] }  // ticket ids that changed
// Auth:  header `x-wallet-push-secret: <WALLET_PUSH_SECRET>`
// Effect: empty push to every device registered for those serials; rows whose
//         token APNs reports as 410 Unregistered are deleted.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const APNS_HOST = "https://api.push.apple.com"; // Wallet pushes always use prod
const PASS_TYPE_ID = "pass.com.stanfordspeakersbureau.ticket";

function pemFromBase64(b64: string): string {
  return atob(b64);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const expectedSecret = Deno.env.get("WALLET_PUSH_SECRET");
  if (
    !expectedSecret ||
    req.headers.get("x-wallet-push-secret") !== expectedSecret
  ) {
    return new Response("Unauthorized", { status: 401 });
  }

  let serialNumbers: string[] = [];
  try {
    const body = (await req.json()) as { serialNumbers?: string[] };
    serialNumbers = Array.isArray(body?.serialNumbers)
      ? body.serialNumbers
      : [];
  } catch {
    return new Response("Bad Request", { status: 400 });
  }
  if (serialNumbers.length === 0) {
    return Response.json({ sent: 0, pruned: 0 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Distinct (push_token, serial) registrations for the changed serials.
  const { data: regs, error } = await supabase
    .from("wallet_registrations")
    .select("push_token, serial_number")
    .in("serial_number", serialNumbers);
  if (error) {
    console.error("[apns-push] registration lookup failed:", error.message);
    return new Response("DB error", { status: 500 });
  }
  if (!regs || regs.length === 0) {
    return Response.json({ sent: 0, pruned: 0 });
  }

  const certB64 = Deno.env.get("APPLE_WALLET_CERT");
  const keyB64 = Deno.env.get("APPLE_WALLET_KEY");
  if (!certB64 || !keyB64) {
    console.error("[apns-push] missing APPLE_WALLET_CERT / APPLE_WALLET_KEY");
    return new Response("Misconfigured", { status: 500 });
  }

  const client = Deno.createHttpClient({
    cert: pemFromBase64(certB64),
    key: pemFromBase64(keyB64),
  });

  let sent = 0;
  const deadTokens = new Set<string>();
  try {
    await Promise.all(
      regs.map(async (reg) => {
        const res = await fetch(`${APNS_HOST}/3/device/${reg.push_token}`, {
          method: "POST",
          headers: {
            "apns-topic": PASS_TYPE_ID,
            "apns-push-type": "background",
            "apns-priority": "5",
            "content-type": "application/json",
          },
          body: "{}",
          // `client` is Deno's fetch extension for a custom (mTLS) HTTP client;
          // the bundled esm.sh types use DOM's RequestInit, which omits it.
          client,
        } as RequestInit & { client: Deno.HttpClient });
        if (res.status === 200) {
          sent++;
        } else if (res.status === 410) {
          deadTokens.add(reg.push_token); // device no longer has the pass
        } else {
          console.warn(
            `[apns-push] ${res.status} for serial ${reg.serial_number}: ${await res.text()}`,
          );
        }
      }),
    );
  } finally {
    client.close();
  }

  let pruned = 0;
  if (deadTokens.size > 0) {
    const { error: delErr, count } = await supabase
      .from("wallet_registrations")
      .delete({ count: "exact" })
      .in("push_token", [...deadTokens]);
    if (delErr) console.error("[apns-push] prune failed:", delErr.message);
    else pruned = count ?? 0;
  }

  return Response.json({ sent, pruned });
});
