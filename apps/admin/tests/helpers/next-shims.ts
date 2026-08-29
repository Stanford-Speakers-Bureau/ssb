import { mock } from "bun:test";

class TestNextResponse extends Response {
  static json(body: unknown, init?: ResponseInit): TestNextResponse {
    const headers = new Headers(init?.headers);
    headers.set("content-type", "application/json");
    return new TestNextResponse(JSON.stringify(body), { ...init, headers });
  }

  static redirect(url: string | URL, status = 307): TestNextResponse {
    return new TestNextResponse(null, {
      status,
      headers: { location: String(url) },
    });
  }
}

export function installNextShims(): void {
  mock.module("next/server", () => ({
    NextRequest: Request,
    NextResponse: TestNextResponse,
    after: (callback: () => unknown) => Promise.resolve(callback()),
  }));
}
