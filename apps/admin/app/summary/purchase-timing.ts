const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export type CanceledTicketMode = "separate" | "as-noshow" | "exclude";

export type PurchaseRange = {
  rangeStart: number;
  rangeEnd: number;
};

type RatePoint = [number, number, number, number];

export type PurchaseTimingChartData = {
  intervalMs: number;
  intervalLabel: string;
  rangeStart: number;
  rangeEnd: number;
  mode: CanceledTicketMode;
  soldBars: [number, number][];
  rateLine: RatePoint[];
  canceledLine: RatePoint[] | null;
  noShowLine: RatePoint[] | null;
  missLine: RatePoint[] | null;
};

export function pickPurchaseInterval(spanMs: number): number {
  if (spanMs <= 3 * HOUR) return MIN;
  if (spanMs <= 12 * HOUR) return 5 * MIN;
  if (spanMs <= 3 * DAY) return 15 * MIN;
  if (spanMs <= 14 * DAY) return HOUR;
  return DAY;
}

export function purchaseIntervalLabel(ms: number): string {
  if (ms <= MIN) return "Minute";
  if (ms < HOUR) return `${ms / MIN} Min`;
  if (ms === HOUR) return "Hour";
  if (ms === DAY) return "Day";
  return `${ms / HOUR}h`;
}

function sortEpochs(epochs: number[]): number[] {
  return epochs.filter((epoch) => Number.isFinite(epoch)).sort((a, b) => a - b);
}

export function buildPurchaseRange(input: {
  ticketEpochs: number[];
  canceledPurchaseEpochs: number[];
  salesOpenMs: number | null;
}): PurchaseRange | null {
  const ticketEpochs = sortEpochs(input.ticketEpochs);
  const canceledPurchaseEpochs = sortEpochs(input.canceledPurchaseEpochs);

  if (ticketEpochs.length === 0) return null;
  // Canceled purchases can fall before the first / after the last live sale,
  // so fold them into the extent or their buckets would render off-axis.
  const firstCanceled = canceledPurchaseEpochs[0];
  const lastCanceled =
    canceledPurchaseEpochs[canceledPurchaseEpochs.length - 1];
  const firstPurchase = Math.min(
    ticketEpochs[0],
    firstCanceled ?? ticketEpochs[0],
  );
  const lastPurchase = Math.max(
    ticketEpochs[ticketEpochs.length - 1],
    lastCanceled ?? ticketEpochs[ticketEpochs.length - 1],
  );
  // Include sales-open in the extent so its marker and the default zoom anchor
  // are visible even if the first sale came later.
  const rangeStart = Math.min(
    firstPurchase,
    input.salesOpenMs ?? firstPurchase,
  );
  const rangeEnd = Math.max(lastPurchase, rangeStart + MIN);
  return { rangeStart, rangeEnd };
}

export function buildDefaultPurchaseZoomRange(input: {
  purchaseRange: PurchaseRange | null;
  salesOpenMs: number | null;
}): [number, number] | null {
  const { purchaseRange, salesOpenMs } = input;
  if (!purchaseRange) return null;
  // Default the visible window to begin at the ticketing date (sales open).
  const start =
    salesOpenMs != null
      ? Math.min(
          Math.max(salesOpenMs, purchaseRange.rangeStart),
          purchaseRange.rangeEnd,
        )
      : purchaseRange.rangeStart;
  return [start, purchaseRange.rangeEnd];
}

export function buildPurchaseTimingChartData(input: {
  purchaseRange: PurchaseRange | null;
  effectivePurchaseZoomRange: [number, number] | null;
  ticketEpochs: number[];
  scannedPurchaseEpochs: number[];
  canceledPurchaseEpochs: number[];
  canceledMode: CanceledTicketMode;
}): PurchaseTimingChartData | null {
  const { purchaseRange, effectivePurchaseZoomRange, canceledMode } = input;
  if (!purchaseRange) return null;
  const { rangeStart, rangeEnd } = purchaseRange;
  const visStart = effectivePurchaseZoomRange
    ? effectivePurchaseZoomRange[0]
    : rangeStart;
  const visEnd = effectivePurchaseZoomRange
    ? effectivePurchaseZoomRange[1]
    : rangeEnd;
  const visibleSpan = Math.max(visEnd - visStart, MIN);
  const intervalMs = pickPurchaseInterval(visibleSpan);
  // Bucket only a padded window around the visible range. This keeps the
  // interval fine (down to 1 min) when zoomed in without producing buckets
  // across an entire weeks-long sales window; the pad lets small pans stay
  // smooth before the next zoom event re-buckets.
  const winStart = Math.max(rangeStart, visStart - visibleSpan);
  const winEnd = Math.min(rangeEnd, visEnd + visibleSpan);
  const alignedStart = Math.floor(winStart / intervalMs) * intervalMs;

  const liveMap = new Map<number, number>();
  const scanMap = new Map<number, number>();
  const canceledMap = new Map<number, number>();
  for (const e of sortEpochs(input.ticketEpochs)) {
    const k = Math.floor(e / intervalMs) * intervalMs;
    liveMap.set(k, (liveMap.get(k) ?? 0) + 1);
  }
  for (const e of sortEpochs(input.scannedPurchaseEpochs)) {
    const k = Math.floor(e / intervalMs) * intervalMs;
    scanMap.set(k, (scanMap.get(k) ?? 0) + 1);
  }
  // In "exclude" mode canceled tickets don't exist as far as the chart is
  // concerned, so skip them entirely (denominator stays live-only).
  if (canceledMode !== "exclude") {
    for (const e of sortEpochs(input.canceledPurchaseEpochs)) {
      const k = Math.floor(e / intervalMs) * intervalMs;
      canceledMap.set(k, (canceledMap.get(k) ?? 0) + 1);
    }
  }

  const soldBars: [number, number][] = [];
  // Each line point is [ts, pct, count, denom] so the tooltip can show n/total.
  // The composition is PER-BUCKET: each point reflects only the tickets *bought
  // during that interval* — of the people who bought in this hour, the share who
  // checked in vs no-showed vs canceled. The three bands sum to the bucket's
  // 100%, so their relative thickness is that hour's outcome mix.
  const rateLine: RatePoint[] = []; // checked in (bottom band)
  const noShowLine: RatePoint[] = []; // no-show band (separate + exclude)
  const canceledLine: RatePoint[] = []; // canceled band (separate)
  const missLine: RatePoint[] = []; // no-show + canceled (as-noshow)

  for (let b = alignedStart; b <= winEnd; b += intervalMs) {
    const live = liveMap.get(b) ?? 0;
    const scanned = scanMap.get(b) ?? 0;
    const canceled = canceledMap.get(b) ?? 0;
    const denom = live + canceled;
    soldBars.push([b, denom]);
    if (denom === 0) continue;

    // Scanned tickets are a subset of live ones, so no-show can't go negative;
    // the guard only matters for degenerate synthetic inputs.
    const noShow = Math.max(live - scanned, 0);
    rateLine.push([b, (scanned / denom) * 100, scanned, denom]);
    if (canceledMode === "as-noshow") {
      const miss = noShow + canceled;
      missLine.push([b, (miss / denom) * 100, miss, denom]);
    } else if (canceledMode === "separate") {
      noShowLine.push([b, (noShow / denom) * 100, noShow, denom]);
      canceledLine.push([b, (canceled / denom) * 100, canceled, denom]);
    } else {
      // exclude: denom is live-only, two bands (checked in + no-show).
      noShowLine.push([b, (noShow / denom) * 100, noShow, denom]);
    }
  }

  return {
    intervalMs,
    intervalLabel: purchaseIntervalLabel(intervalMs),
    rangeStart,
    rangeEnd,
    mode: canceledMode,
    soldBars,
    rateLine,
    canceledLine: canceledMode === "separate" ? canceledLine : null,
    noShowLine: canceledMode === "as-noshow" ? null : noShowLine,
    missLine: canceledMode === "as-noshow" ? missLine : null,
  };
}
