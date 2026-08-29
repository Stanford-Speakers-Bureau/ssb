import { describe, expect, it, mock } from "bun:test";

import {
  getProcessedCount,
  getSkipBreakdownSegments,
  runChunkedSend,
  type BulkSendProgressState,
} from "../bulkSend";

describe("runChunkedSend", () => {
  it("runs chunks sequentially and reports cumulative progress", async () => {
    const progress: BulkSendProgressState[] = [];
    const resolvers: Array<() => void> = [];
    const sendChunk = mock(
      (chunk: number[], context: { chunkIndex: number; chunkCount: number }) =>
        new Promise<{ sent: number }>((resolve) => {
          resolvers.push(() => resolve({ sent: chunk.length }));
          expect(context.chunkCount).toBe(3);
        }),
    );

    const resultPromise = runChunkedSend({
      items: [1, 2, 3, 4, 5],
      chunkSize: 2,
      label: "Sending",
      onProgress: (state) => progress.push({ ...state }),
      sendChunk,
    });

    expect(sendChunk).toHaveBeenCalledTimes(1);
    resolvers.shift()?.();
    await Promise.resolve();
    expect(sendChunk).toHaveBeenCalledTimes(2);
    resolvers.shift()?.();
    await Promise.resolve();
    expect(sendChunk).toHaveBeenCalledTimes(3);
    resolvers.shift()?.();

    const result = await resultPromise;
    expect(sendChunk.mock.calls.map((call) => call[0])).toEqual([
      [1, 2],
      [3, 4],
      [5],
    ]);
    expect(sendChunk.mock.calls.map((call) => call[1].chunkIndex)).toEqual([
      0, 1, 2,
    ]);
    expect(result).toMatchObject({
      sent: 5,
      failed: 0,
      active: false,
      done: true,
    });
    expect(progress.at(-1)).toEqual(result);
  });

  it("aggregates failed chunks and continues", async () => {
    const result = await runChunkedSend({
      items: [1, 2, 3, 4, 5],
      chunkSize: 2,
      label: "Sending",
      onProgress: () => undefined,
      sendChunk: async (chunk, { chunkIndex }) => {
        if (chunkIndex === 1) throw new Error("temporary failure");
        return {
          sent: chunkIndex === 2 ? 0 : chunk.length,
          skippedOptedOut: chunkIndex === 2 ? 1 : 0,
        };
      },
    });

    expect(result).toMatchObject({ sent: 2, failed: 2, skippedOptedOut: 1 });
    expect(getProcessedCount(result)).toBe(5);
  });

  it("publishes a final state before rethrowing fatal errors", async () => {
    const progress: BulkSendProgressState[] = [];
    const fatal = new Error("unauthorized");
    await expect(
      runChunkedSend({
        items: [1, 2],
        chunkSize: 1,
        label: "Sending",
        onProgress: (state) => progress.push({ ...state }),
        shouldAbortOnError: (error) => error === fatal,
        sendChunk: async () => {
          throw fatal;
        },
      }),
    ).rejects.toBe(fatal);
    expect(progress.at(-1)).toMatchObject({ active: false, done: true });
  });
});

describe("bulk-send counters", () => {
  it("formats only non-zero skip categories in a stable order", () => {
    expect(
      getSkipBreakdownSegments({
        skippedHasTicket: 2,
        skippedOptedOut: 3,
        suppressed: 4,
        skipped: 1,
      }),
    ).toEqual([
      "2 already had a ticket",
      "3 opted out",
      "4 suppressed",
      "1 skipped",
    ]);
    expect(getSkipBreakdownSegments({})).toEqual([]);
  });

  it("counts every terminal recipient category", () => {
    expect(
      getProcessedCount({
        active: true,
        total: 21,
        sent: 1,
        failed: 2,
        skipped: 3,
        skippedHasTicket: 4,
        skippedOptedOut: 5,
        suppressed: 6,
        done: false,
        label: "Sending",
      }),
    ).toBe(21);
  });
});
