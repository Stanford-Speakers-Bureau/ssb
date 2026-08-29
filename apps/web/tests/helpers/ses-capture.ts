export type CapturedEmail = {
  rawMime: string;
  subject: string | null;
};

function extractRawData(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const value = body as Record<string, unknown>;
  const content = value.Content as Record<string, unknown> | undefined;
  const raw = content?.Raw as Record<string, unknown> | undefined;
  return typeof raw?.Data === "string" ? raw.Data : null;
}

export function normalizeMime(rawMime: string): string {
  return rawMime
    .replace(/(?:mix|alt|rel)_\d+_[a-z0-9.]+/gi, "BOUNDARY")
    .replace(/([?&]token=)[\w.-]+/g, "$1<TOKEN>")
    .replace(/^Date: .*$/gim, "Date: <DATE>")
    .replace(/^Message-ID: .*$/gim, "Message-ID: <MESSAGE_ID>");
}

export function summarizeMime(rawMime: string): string {
  return normalizeMime(rawMime)
    .split(/\r?\n/)
    .filter((line) =>
      /^(Subject|Content-Type|Content-Disposition|Content-ID):/i.test(line),
    )
    .join("\n");
}

export function captureSesFetch() {
  const originalFetch = globalThis.fetch;
  const messages: CapturedEmail[] = [];

  const interceptedFetch = async (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ) => {
    const url = input instanceof Request ? input.url : String(input);
    if (!/^https:\/\/email\.[^.]+\.amazonaws\.com/i.test(url)) {
      return originalFetch(input, init);
    }

    const body = typeof init?.body === "string" ? JSON.parse(init.body) : null;
    const encoded = extractRawData(body);
    if (!encoded)
      throw new Error("SES request did not contain Content.Raw.Data");

    const rawMime = Buffer.from(encoded, "base64").toString("utf8");
    const subject = rawMime.match(/^Subject:\s*(.+)$/im)?.[1]?.trim() ?? null;
    messages.push({ rawMime, subject });
    return Response.json({ MessageId: "test-message-id" }, { status: 200 });
  };
  globalThis.fetch = interceptedFetch as typeof fetch;

  return {
    messages,
    restore() {
      globalThis.fetch = originalFetch;
    },
  };
}
