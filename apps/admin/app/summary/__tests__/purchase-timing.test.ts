import { describe, expect, test } from "bun:test";
import {
  buildDefaultPurchaseZoomRange,
  buildPurchaseRange,
  buildPurchaseTimingChartData,
} from "../purchase-timing";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const T0 = Date.parse("2026-01-01T00:00:00.000Z");
const ONE_OF_THREE_PERCENT = (1 / 3) * 100;
const TWO_OF_THREE_PERCENT = (2 / 3) * 100;

function pointFor(
  points: Array<[number, number, number, number]>,
  timestamp: number,
) {
  const bucket = Math.floor(timestamp / MIN) * MIN;
  return points.find((point) => point[0] === bucket);
}

function barFor(points: Array<[number, number]>, timestamp: number) {
  const bucket = Math.floor(timestamp / MIN) * MIN;
  return points.find((point) => point[0] === bucket);
}

describe("buildPurchaseRange", () => {
  test("includes canceled purchases outside the live ticket extent", () => {
    const range = buildPurchaseRange({
      ticketEpochs: [T0 + 10 * MIN, T0 + 20 * MIN],
      canceledPurchaseEpochs: [T0, T0 + 30 * MIN],
      salesOpenMs: null,
    });

    expect(range).toEqual({
      rangeStart: T0,
      rangeEnd: T0 + 30 * MIN,
    });
  });

  test("includes sales open when it predates the first purchase", () => {
    const range = buildPurchaseRange({
      ticketEpochs: [T0 + 10 * MIN],
      canceledPurchaseEpochs: [],
      salesOpenMs: T0,
    });

    expect(range).toEqual({
      rangeStart: T0,
      rangeEnd: T0 + 10 * MIN,
    });
  });
});

describe("buildDefaultPurchaseZoomRange", () => {
  test("clamps the sales-open anchor inside the chart range", () => {
    const range = { rangeStart: T0, rangeEnd: T0 + 10 * MIN };

    expect(
      buildDefaultPurchaseZoomRange({
        purchaseRange: range,
        salesOpenMs: T0 - 5 * MIN,
      }),
    ).toEqual([T0, T0 + 10 * MIN]);

    expect(
      buildDefaultPurchaseZoomRange({
        purchaseRange: range,
        salesOpenMs: T0 + 15 * MIN,
      }),
    ).toEqual([T0 + 10 * MIN, T0 + 10 * MIN]);
  });
});

describe("buildPurchaseTimingChartData", () => {
  const purchaseRange = { rangeStart: T0, rangeEnd: T0 + MIN };
  const commonInput = {
    purchaseRange,
    effectivePurchaseZoomRange: [T0, T0 + MIN] as [number, number],
    ticketEpochs: [T0 + 1_000, T0 + 2_000],
    scannedPurchaseEpochs: [T0 + 1_000],
    canceledPurchaseEpochs: [T0 + 3_000],
  };

  test("separate mode counts canceled tickets in the denominator and splits no-shows", () => {
    const data = buildPurchaseTimingChartData({
      ...commonInput,
      canceledMode: "separate",
    });

    expect(data?.intervalMs).toBe(MIN);
    expect(barFor(data?.soldBars ?? [], T0)).toEqual([T0, 3]);
    expect(pointFor(data?.rateLine ?? [], T0)).toEqual([
      T0,
      ONE_OF_THREE_PERCENT,
      1,
      3,
    ]);
    expect(pointFor(data?.canceledLine ?? [], T0)).toEqual([
      T0,
      ONE_OF_THREE_PERCENT,
      1,
      3,
    ]);
    expect(pointFor(data?.noShowLine ?? [], T0)).toEqual([
      T0,
      ONE_OF_THREE_PERCENT,
      1,
      3,
    ]);
    expect(data?.missLine).toBeNull();
  });

  test("as-noshow mode folds canceled tickets into one miss line", () => {
    const data = buildPurchaseTimingChartData({
      ...commonInput,
      canceledMode: "as-noshow",
    });

    expect(pointFor(data?.rateLine ?? [], T0)).toEqual([
      T0,
      ONE_OF_THREE_PERCENT,
      1,
      3,
    ]);
    expect(pointFor(data?.missLine ?? [], T0)).toEqual([
      T0,
      TWO_OF_THREE_PERCENT,
      2,
      3,
    ]);
    expect(data?.canceledLine).toBeNull();
    expect(data?.noShowLine).toBeNull();
  });

  test("exclude mode removes canceled tickets from the population", () => {
    const data = buildPurchaseTimingChartData({
      ...commonInput,
      canceledMode: "exclude",
    });

    expect(barFor(data?.soldBars ?? [], T0)).toEqual([T0, 2]);
    expect(pointFor(data?.rateLine ?? [], T0)).toEqual([T0, 50, 1, 2]);
    // Two bands (show-up + no-show) over the live-only denominator, no canceled.
    expect(pointFor(data?.noShowLine ?? [], T0)).toEqual([T0, 50, 1, 2]);
    expect(data?.canceledLine).toBeNull();
    expect(data?.missLine).toBeNull();
  });

  test("each bucket reflects only the tickets bought during that interval", () => {
    const data = buildPurchaseTimingChartData({
      purchaseRange: { rangeStart: T0, rangeEnd: T0 + 20 * DAY },
      effectivePurchaseZoomRange: [T0, T0 + 20 * DAY],
      // One early buyer who flakes, one later buyer (day 10) who shows up.
      ticketEpochs: [T0 + HOUR, T0 + 10 * DAY + HOUR],
      scannedPurchaseEpochs: [T0 + 10 * DAY + HOUR],
      canceledPurchaseEpochs: [],
      canceledMode: "separate",
    });

    expect(data?.intervalMs).toBe(DAY);
    // Day 0 bucket: only the early buyer, who never checked in — 100% no-show.
    expect(pointFor(data?.rateLine ?? [], T0)).toEqual([T0, 0, 0, 1]);
    expect(pointFor(data?.noShowLine ?? [], T0)).toEqual([T0, 100, 1, 1]);
    // Day 10 bucket: only the later buyer, who checked in — 100% show-up. Each
    // bucket stands alone; day 0's flaker does not bleed into day 10.
    expect(pointFor(data?.rateLine ?? [], T0 + 10 * DAY)).toEqual([
      T0 + 10 * DAY,
      100,
      1,
      1,
    ]);
    expect(pointFor(data?.noShowLine ?? [], T0 + 10 * DAY)).toEqual([
      T0 + 10 * DAY,
      0,
      0,
      1,
    ]);
  });

  test("caps live no-show counts at zero when scans exceed live purchases", () => {
    const data = buildPurchaseTimingChartData({
      purchaseRange,
      effectivePurchaseZoomRange: [T0, T0 + MIN],
      ticketEpochs: [T0 + 1_000],
      scannedPurchaseEpochs: [T0 + 1_000, T0 + 2_000],
      canceledPurchaseEpochs: [T0 + 3_000],
      canceledMode: "separate",
    });

    expect(pointFor(data?.rateLine ?? [], T0)).toEqual([T0, 100, 2, 2]);
    expect(pointFor(data?.noShowLine ?? [], T0)).toEqual([T0, 0, 0, 2]);
  });
});
