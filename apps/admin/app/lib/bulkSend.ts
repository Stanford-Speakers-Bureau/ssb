export type BulkSendProgressState = {
  active: boolean;
  total: number;
  sent: number;
  failed: number;
  /**
   * Generic skip count for endpoints whose skip has a single, self-evident
   * meaning (e.g. feedback-analytics "ticket never scanned"). For email sends
   * the reason is broken out into the categorized fields below — prefer those.
   */
  skipped: number;
  /** Recipients dropped because they already hold a ticket for the event. */
  skippedHasTicket: number;
  /** Recipients dropped because of a mailing-list opt-out (announce/event). */
  skippedOptedOut: number;
  /** Recipients dropped by the email-suppression kill-switch (hard block). */
  suppressed: number;
  done: boolean;
  label: string;
};

export type BulkSendChunkResult = {
  sent?: number;
  failed?: number;
  skipped?: number;
  skippedHasTicket?: number;
  skippedOptedOut?: number;
  suppressed?: number;
};

export type BulkSendChunkContext = {
  batchId: string;
  chunkIndex: number;
  chunkCount: number;
};

type RunChunkedSendOptions<T> = {
  items: T[];
  chunkSize: number;
  label: string;
  onProgress: (state: BulkSendProgressState) => void;
  shouldAbortOnError?: (error: unknown) => boolean;
  sendChunk: (
    chunk: T[],
    context: BulkSendChunkContext,
  ) => Promise<BulkSendChunkResult>;
};

/**
 * Build human-readable segments for the non-zero "not sent" categories, kept
 * distinct so admins can tell apart a recipient who already has a ticket, one
 * who opted out of the mailing list, and one who is hard-suppressed.
 */
export function getSkipBreakdownSegments(counts: {
  skipped?: number;
  skippedHasTicket?: number;
  skippedOptedOut?: number;
  suppressed?: number;
}): string[] {
  const segments: string[] = [];
  if ((counts.skippedHasTicket ?? 0) > 0) {
    segments.push(`${counts.skippedHasTicket} already had a ticket`);
  }
  if ((counts.skippedOptedOut ?? 0) > 0) {
    segments.push(`${counts.skippedOptedOut} opted out`);
  }
  if ((counts.suppressed ?? 0) > 0) {
    segments.push(`${counts.suppressed} suppressed`);
  }
  if ((counts.skipped ?? 0) > 0) {
    segments.push(`${counts.skipped} skipped`);
  }
  return segments;
}

export function getProcessedCount(state: BulkSendProgressState): number {
  return (
    state.sent +
    state.failed +
    state.skipped +
    state.skippedHasTicket +
    state.skippedOptedOut +
    state.suppressed
  );
}

export async function runChunkedSend<T>({
  items,
  chunkSize,
  label,
  onProgress,
  shouldAbortOnError,
  sendChunk,
}: RunChunkedSendOptions<T>): Promise<BulkSendProgressState> {
  const batchId = globalThis.crypto?.randomUUID?.() ??
    `audit-batch-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const chunkCount = Math.ceil(items.length / chunkSize);
  let state: BulkSendProgressState = {
    active: true,
    total: items.length,
    sent: 0,
    failed: 0,
    skipped: 0,
    skippedHasTicket: 0,
    skippedOptedOut: 0,
    suppressed: 0,
    done: false,
    label,
  };

  onProgress(state);

  for (let index = 0; index < items.length; index += chunkSize) {
    const chunk = items.slice(index, index + chunkSize);
    const chunkIndex = index / chunkSize;

    try {
      const result = await sendChunk(chunk, {
        batchId,
        chunkIndex,
        chunkCount,
      });
      state = {
        ...state,
        sent: state.sent + (result.sent ?? 0),
        failed: state.failed + (result.failed ?? 0),
        skipped: state.skipped + (result.skipped ?? 0),
        skippedHasTicket: state.skippedHasTicket + (result.skippedHasTicket ?? 0),
        skippedOptedOut: state.skippedOptedOut + (result.skippedOptedOut ?? 0),
        suppressed: state.suppressed + (result.suppressed ?? 0),
      };
    } catch (error) {
      if (shouldAbortOnError?.(error)) {
        state = {
          ...state,
          active: false,
          done: true,
        };
        onProgress(state);
        throw error;
      }

      state = {
        ...state,
        failed: state.failed + chunk.length,
      };
    }

    onProgress(state);
  }

  state = {
    ...state,
    active: false,
    done: true,
  };

  onProgress(state);
  return state;
}
