import { afterEach, describe, expect, it, mock } from "bun:test";

import {
  FetchTimeoutError,
  fetchWithTimeout,
  isFetchTimeoutError,
} from "../fetch";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("fetchWithTimeout", () => {
  it("turns its own abort into FetchTimeoutError", async () => {
    globalThis.fetch = mock(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        }),
    ) as unknown as typeof fetch;

    const result = fetchWithTimeout("https://example.test", {}, 1);

    const error = await result.catch((caught) => caught);
    expect(error).toBeInstanceOf(FetchTimeoutError);
    expect(error.timeoutMs).toBe(1);
    expect(isFetchTimeoutError(error)).toBe(true);
  });

  it("preserves an external abort reason", async () => {
    const reason = new Error("caller cancelled");
    const controller = new AbortController();
    globalThis.fetch = mock(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(init.signal?.reason),
          );
        }),
    ) as unknown as typeof fetch;

    const result = fetchWithTimeout(
      "https://example.test",
      { signal: controller.signal },
      10_000,
    );
    controller.abort(reason);

    await expect(result).rejects.toBe(reason);
  });

  it("returns a response that completes before the deadline", async () => {
    const response = new Response("ok", { status: 200 });
    globalThis.fetch = mock(async () => response) as unknown as typeof fetch;
    await expect(
      fetchWithTimeout("https://example.test", {}, 100),
    ).resolves.toBe(response);
  });
});
