export class FetchTimeoutError extends Error {
  constructor(
    public readonly timeoutMs: number,
    message = `Request timed out after ${timeoutMs}ms`,
  ) {
    super(message);
    this.name = "FetchTimeoutError";
  }
}

export function isFetchTimeoutError(
  error: unknown,
): error is FetchTimeoutError {
  return error instanceof FetchTimeoutError;
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 10_000,
): Promise<Response> {
  const controller = new AbortController();
  let didTimeout = false;

  if (init.signal?.aborted) {
    controller.abort(init.signal.reason);
  }

  const handleAbort = () => {
    controller.abort(init.signal?.reason);
  };

  init.signal?.addEventListener("abort", handleAbort, { once: true });

  const timeoutId = setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (didTimeout) {
      throw new FetchTimeoutError(timeoutMs);
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
    init.signal?.removeEventListener("abort", handleAbort);
  }
}
