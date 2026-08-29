"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import {
  CheckCircleIcon,
  InformationCircleIcon,
} from "@heroicons/react/16/solid";
import { useEventContext } from "@/app/EventContext";
import {
  getAnalyticsCardGridStyle,
  getDefaultTimelineZoomRange,
} from "@/app/lib/utils";
import ReactECharts from "echarts-for-react";
import { Card, EmptyState, PageHeader } from "@/app/components/ui";
import {
  buildDefaultPurchaseZoomRange,
  buildPurchaseRange,
  buildPurchaseTimingChartData,
  type CanceledTicketMode,
} from "./purchase-timing";

// ── Types ────────────────────────────────────────────────────────────────

type TypeBreakdown = { total: number; scanned: number; flakeRate: number };
type ScannerEntry = { name: string; email: string; count: number };
type FeedbackStats = {
  responseCount: number;
  responseRate: number;
  averageScore: number | null;
  nps: number | null;
  promoterCount: number;
  passiveCount: number;
  detractorCount: number;
  commentCount: number;
  recentComments: Array<{
    id: string;
    attendeeName: string | null;
    attendeeEmail: string | null;
    score: number;
    comment: string;
    updatedAt: string;
  }>;
};

type SummaryResponse = {
  eventName: string | null;
  eventDate: string | null;
  capacity: number;
  reserved: number;
  salesOpenAt: string | null;
  doorsOpen: string | null;
  startTime: string | null;
  standbyEnabled: boolean;
  totalTickets: number;
  scannedCount: number;
  unscannedCount: number;
  flakeRate: number;
  byType: Record<"STANDARD" | "VIP" | "EXTERNAL" | "STANDBY", TypeBreakdown>;
  scanTimestamps: string[];
  ticketTimestamps: string[];
  scannedPurchaseTimestamps: string[];
  // Canceled tickets are hard-deleted from `tickets`, so these come from the
  // canceled_tickets archive. `purchase` = original buy time (chart x-axis),
  // `canceledAt` = when it was canceled. Parallel arrays, same order. Optional so
  // an older API response (mid-deploy) degrades to the pre-cancellation chart.
  canceledPurchaseTimestamps?: string[];
  canceledAtTimestamps?: string[];
  waitlistCount: number;
  averageArrivalOffsetMs: number | null;
  peakInterval: { start: string; end: string; count: number } | null;
  scannerLeaderboard: ScannerEntry[];
  earlyBirdFlake: {
    earlyFlakeRate: number;
    lateFlakeRate: number;
    earlyTotal: number;
    lateTotal: number;
  } | null;
  referralAttendance: {
    referralShowRate: number;
    organicShowRate: number;
    referralTotal: number;
    organicTotal: number;
  } | null;
  arrivalDistribution: {
    buckets: { label: string; count: number }[];
    total: number;
  } | null;
  feedbackStats: FeedbackStats;
};

// ── Helpers ──────────────────────────────────────────────────────────────

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

function pickInterval(spanMs: number): number {
  if (spanMs <= 3 * HOUR) return MIN;
  if (spanMs <= 12 * HOUR) return 5 * MIN;
  if (spanMs <= 3 * DAY) return 15 * MIN;
  if (spanMs <= 14 * DAY) return HOUR;
  return DAY;
}

function intervalLabel(ms: number): string {
  if (ms <= MIN) return "Minute";
  if (ms < HOUR) return `${ms / MIN} Min`;
  if (ms === HOUR) return "Hour";
  if (ms === DAY) return "Day";
  return `${ms / HOUR}h`;
}

function pickCheckinInterval(spanMs: number): number {
  if (spanMs <= 90 * MIN) return 5 * MIN;
  if (spanMs <= 4 * HOUR) return 10 * MIN;
  if (spanMs <= 8 * HOUR) return 15 * MIN;
  return HOUR;
}

function toEpoch(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

function bucketEpochs(
  epochs: number[],
  intervalMs: number,
  rangeStart: number,
  rangeEnd: number,
): [number, number, number][] {
  const alignedStart = Math.floor(rangeStart / intervalMs) * intervalMs;
  const result: [number, number, number][] = [];
  let cumulative = 0;
  let idx = 0;
  while (idx < epochs.length && epochs[idx] < alignedStart) {
    cumulative++;
    idx++;
  }
  let bucketStart = alignedStart;
  while (bucketStart <= rangeEnd) {
    const bucketEnd = bucketStart + intervalMs;
    let count = 0;
    while (idx < epochs.length && epochs[idx] < bucketEnd) {
      count++;
      idx++;
    }
    cumulative += count;
    result.push([bucketStart, count, cumulative]);
    bucketStart = bucketEnd;
  }
  return result;
}

function formatDuration(ms: number): string {
  const totalMins = Math.floor(ms / 60_000);
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

function formatTimeRange(start: string, end: string): string {
  const fmt = (s: string) =>
    new Date(s).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "America/Los_Angeles",
    });
  return `${fmt(start)} – ${fmt(end)}`;
}

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
  });
}

function ProgressBar({
  value,
  max,
  color = "#10b981",
}: {
  value: number;
  max: number;
  color?: string;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="w-full bg-zinc-800 rounded-full h-2.5 overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

const TYPE_CONFIG = [
  {
    key: "STANDARD" as const,
    label: "Standard",
    color: "#3b82f6",
    bg: "bg-blue-500/10 border-blue-500/20",
    text: "text-blue-400",
  },
  {
    key: "VIP" as const,
    label: "VIP",
    color: "#8b5cf6",
    bg: "bg-violet-500/10 border-violet-500/20",
    text: "text-violet-400",
  },
  {
    key: "EXTERNAL" as const,
    label: "External",
    color: "#10b981",
    bg: "bg-emerald-500/10 border-emerald-500/20",
    text: "text-emerald-400",
  },
  {
    key: "STANDBY" as const,
    label: "Standby",
    color: "#f59e0b",
    bg: "bg-amber-500/10 border-amber-500/20",
    text: "text-amber-400",
  },
];

const ARRIVAL_COLORS = [
  "#8b5cf6",
  "#3b82f6",
  "#06b6d4",
  "#10b981",
  "#f59e0b",
  "#f43f5e",
];

// ── Main Component ───────────────────────────────────────────────────────

function SummaryContent({ eventId }: { eventId: string }) {
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkinZoomRange, setCheckinZoomRange] = useState<
    [number, number] | null
  >(null);
  const checkinChartRef = useRef<ReactECharts>(null);
  const checkinDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [purchaseZoomRange, setPurchaseZoomRange] = useState<
    [number, number] | null
  >(null);
  // How the purchase-timing chart treats canceled tickets:
  //   separate  — count them in the denominator, plot canceled % and no-show %
  //               as their own lines (default).
  //   as-noshow — count them in the denominator, fold them into one combined
  //               "no-show + canceled" line. This is the accurate launch-day
  //               read: "of everyone who bought at time T, what % showed up",
  //               since late cancellations are still no-shows.
  //   exclude   — drop them entirely (the original, live-tickets-only chart).
  const [canceledMode, setCanceledMode] =
    useState<CanceledTicketMode>("separate");
  const purchaseChartRef = useRef<ReactECharts>(null);
  const purchaseDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    const controller = new AbortController();

    async function fetchData() {
      try {
        setIsLoading(true);
        setError(null);
        const res = await fetch(`/api/events/${eventId}/summary`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to fetch summary data");
        }
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (err) {
        if (
          cancelled ||
          (err as { name?: string } | null)?.name === "AbortError"
        ) {
          return;
        }
        console.error("Error fetching summary:", err);
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchData();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [eventId]);

  useEffect(() => {
    setCheckinZoomRange(null);
    setPurchaseZoomRange(null);
  }, [eventId]);

  // ── Chart: Sales vs Check-ins overlay ──

  const scanEpochs = useMemo(() => {
    if (!data) return [];
    return data.scanTimestamps.map((t) => new Date(t).getTime());
  }, [data]);

  const ticketEpochs = useMemo(() => {
    if (!data) return [];
    return data.ticketTimestamps.map((t) => new Date(t).getTime());
  }, [data]);

  const scannedPurchaseEpochs = useMemo(() => {
    if (!data) return [];
    return data.scannedPurchaseTimestamps
      .map((t) => new Date(t).getTime())
      .sort((a, b) => a - b);
  }, [data]);

  // Purchase times of canceled tickets (from the canceled_tickets archive).
  const canceledPurchaseEpochs = useMemo(() => {
    if (!data?.canceledPurchaseTimestamps) return [];
    return data.canceledPurchaseTimestamps
      .map((t) => new Date(t).getTime())
      .sort((a, b) => a - b);
  }, [data]);

  const eventStartMs = useMemo(
    () => toEpoch(data?.startTime),
    [data?.startTime],
  );
  const doorsOpenMs = useMemo(
    () => toEpoch(data?.doorsOpen),
    [data?.doorsOpen],
  );
  const salesOpenMs = useMemo(
    () => toEpoch(data?.salesOpenAt),
    [data?.salesOpenAt],
  );

  const salesChartData = useMemo(() => {
    if (ticketEpochs.length === 0) return null;
    const rangeStart = ticketEpochs[0];
    const rangeEnd = Math.max(
      eventStartMs ?? ticketEpochs[ticketEpochs.length - 1],
      ticketEpochs[ticketEpochs.length - 1],
      rangeStart + MIN,
    );
    const intervalMs = pickInterval(Math.max(rangeEnd - rangeStart, MIN));
    return {
      intervalMs,
      intervalLabel: intervalLabel(intervalMs),
      bucketed: bucketEpochs(ticketEpochs, intervalMs, rangeStart, rangeEnd),
    };
  }, [eventStartMs, ticketEpochs]);

  const checkinChartData = useMemo(() => {
    if (scanEpochs.length === 0) return null;
    const anchorStart = doorsOpenMs ?? eventStartMs ?? scanEpochs[0];
    const rangeStart = Math.min(scanEpochs[0], anchorStart - 15 * MIN);
    const rangeEnd = Math.max(
      scanEpochs[scanEpochs.length - 1],
      eventStartMs != null ? eventStartMs + 90 * MIN : anchorStart + 2 * HOUR,
      rangeStart + MIN,
    );
    const intervalMs = pickCheckinInterval(
      Math.max(rangeEnd - rangeStart, MIN),
    );
    return {
      intervalMs,
      intervalLabel: intervalLabel(intervalMs),
      rangeStart,
      rangeEnd,
      bucketed: bucketEpochs(scanEpochs, intervalMs, rangeStart, rangeEnd),
    };
  }, [doorsOpenMs, eventStartMs, scanEpochs]);

  const defaultCheckinZoomRange = useMemo<[number, number] | null>(() => {
    if (!checkinChartData) return null;
    return getDefaultTimelineZoomRange({
      rangeStart: checkinChartData.rangeStart,
      rangeEnd: checkinChartData.rangeEnd,
      doorsOpenMs,
      eventStartMs,
      paddingMs: 0,
    });
  }, [checkinChartData, doorsOpenMs, eventStartMs]);

  const effectiveCheckinZoomRange = checkinZoomRange ?? defaultCheckinZoomRange;

  const visibleCheckinAverageRate = useMemo(() => {
    if (!checkinChartData || !effectiveCheckinZoomRange) return 0;
    const scansInWindow = scanEpochs.filter(
      (epoch) =>
        epoch >= effectiveCheckinZoomRange[0] &&
        epoch <= effectiveCheckinZoomRange[1],
    ).length;
    const elapsedMinutes = Math.max(
      (effectiveCheckinZoomRange[1] - effectiveCheckinZoomRange[0]) / MIN,
      1,
    );

    return scansInWindow / elapsedMinutes;
  }, [checkinChartData, effectiveCheckinZoomRange, scanEpochs]);

  const visibleCheckinAverageBucketRate = useMemo(() => {
    if (!checkinChartData) return 0;
    return visibleCheckinAverageRate * (checkinChartData.intervalMs / MIN);
  }, [checkinChartData, visibleCheckinAverageRate]);

  const onCheckinDataZoom = useCallback(() => {
    clearTimeout(checkinDebounceRef.current);
    checkinDebounceRef.current = setTimeout(() => {
      const instance = checkinChartRef.current?.getEchartsInstance();
      const fullRange = checkinChartData
        ? [checkinChartData.rangeStart, checkinChartData.rangeEnd]
        : null;
      if (!instance || !fullRange) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const opt = instance.getOption() as any;
      const dz = opt.dataZoom?.[0];
      if (!dz) return;

      if (dz.startValue != null && dz.endValue != null) {
        setCheckinZoomRange([dz.startValue, dz.endValue]);
      } else if (dz.start != null && dz.end != null) {
        const span = fullRange[1] - fullRange[0];
        setCheckinZoomRange([
          fullRange[0] + (dz.start / 100) * span,
          fullRange[0] + (dz.end / 100) * span,
        ]);
      }
    }, 120);
  }, [checkinChartData]);

  const checkinOnEvents = useMemo(
    () => ({ datazoom: onCheckinDataZoom }),
    [onCheckinDataZoom],
  );

  const salesChartOption = useMemo(() => {
    if (!salesChartData) return null;

    const salesBars = salesChartData.bucketed.map(([ts, count]) => [ts, count]);
    const salesLine = salesChartData.bucketed.map(([ts, , cumulative]) => [
      ts,
      cumulative,
    ]);
    const eventMarkers =
      eventStartMs != null
        ? [
            {
              xAxis: eventStartMs,
              label: {
                formatter: "Event Start",
                color: "#e4e4e7",
                fontSize: 10,
                position: "insideEndTop",
              },
              lineStyle: { color: "#71717a", type: "dashed" as const },
            },
          ]
        : [];

    return {
      backgroundColor: "transparent",
      animation: true,
      tooltip: {
        trigger: "axis" as const,
        backgroundColor: "#18181b",
        borderColor: "#3f3f46",
        borderWidth: 1,
        textStyle: { color: "#fafafa", fontSize: 12 },
        axisPointer: {
          type: "cross" as const,
          crossStyle: { color: "#71717a" },
        },
      },
      legend: {
        data: ["Cumulative Sold", `Per ${salesChartData.intervalLabel}`],
        textStyle: { color: "#a1a1aa", fontSize: 12 },
        top: 0,
        left: "center",
        itemGap: 20,
        icon: "roundRect",
        itemWidth: 14,
        itemHeight: 8,
      },
      grid: { top: 40, right: 56, bottom: 28, left: 56, containLabel: false },
      xAxis: {
        type: "time" as const,
        axisLabel: { color: "#71717a", fontSize: 10, hideOverlap: true },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
      },
      yAxis: [
        {
          type: "value" as const,
          name: "Cumulative",
          nameTextStyle: {
            color: "#71717a",
            fontSize: 10,
            padding: [0, 0, 0, -24],
          },
          axisLabel: { color: "#71717a", fontSize: 10 },
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: {
            lineStyle: { color: "#27272a", type: "dashed" as const },
          },
          minInterval: 1,
        },
        {
          type: "value" as const,
          name: `Per ${salesChartData.intervalLabel}`,
          nameTextStyle: {
            color: "#71717a",
            fontSize: 10,
            padding: [0, -24, 0, 0],
          },
          axisLabel: { color: "#71717a", fontSize: 10 },
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { show: false },
          minInterval: 1,
        },
      ],
      series: [
        {
          name: `Per ${salesChartData.intervalLabel}`,
          type: "bar" as const,
          yAxisIndex: 1,
          data: salesBars,
          itemStyle: {
            color: "rgba(59,130,246,0.35)",
            borderRadius: [3, 3, 0, 0],
          },
          emphasis: { itemStyle: { color: "#60a5fa" } },
          barMaxWidth: 28,
          z: 1,
        },
        {
          name: "Cumulative Sold",
          type: "line" as const,
          yAxisIndex: 0,
          data: salesLine,
          smooth: true,
          symbol: "none",
          lineStyle: { width: 2, color: "#3b82f6" },
          areaStyle: {
            color: {
              type: "linear" as const,
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(59,130,246,0.15)" },
                { offset: 1, color: "rgba(59,130,246,0)" },
              ],
            },
          },
          markLine:
            eventMarkers.length > 0
              ? {
                  symbol: "none",
                  data: eventMarkers,
                }
              : undefined,
          z: 2,
        },
      ],
    };
  }, [eventStartMs, salesChartData]);

  const checkinChartOption = useMemo(() => {
    if (!checkinChartData) return null;

    const checkinBars = checkinChartData.bucketed.map(([ts, count]) => [
      ts,
      count,
    ]);
    const checkinLine = checkinChartData.bucketed.map(([ts, , cumulative]) => [
      ts,
      cumulative,
    ]);
    const zoomProps = effectiveCheckinZoomRange
      ? {
          startValue: effectiveCheckinZoomRange[0],
          endValue: effectiveCheckinZoomRange[1],
        }
      : {};
    const markerLines = [
      doorsOpenMs != null
        ? {
            xAxis: doorsOpenMs,
            label: {
              formatter: "Doors",
              color: "#e4e4e7",
              fontSize: 10,
              position: "insideEndTop",
            },
            lineStyle: { color: "#f59e0b", type: "dashed" as const },
          }
        : null,
      eventStartMs != null
        ? {
            xAxis: eventStartMs,
            label: {
              formatter: "Start",
              color: "#e4e4e7",
              fontSize: 10,
              position: "insideEndTop",
            },
            lineStyle: { color: "#71717a", type: "dashed" as const },
          }
        : null,
    ].filter(
      (
        value,
      ): value is {
        xAxis: number;
        label: {
          formatter: string;
          color: string;
          fontSize: number;
          position: string;
        };
        lineStyle: { color: string; type: "dashed" };
      } => value !== null,
    );

    return {
      backgroundColor: "transparent",
      animation: true,
      tooltip: {
        trigger: "axis" as const,
        backgroundColor: "#18181b",
        borderColor: "#3f3f46",
        borderWidth: 1,
        textStyle: { color: "#fafafa", fontSize: 12 },
        axisPointer: {
          type: "cross" as const,
          crossStyle: { color: "#71717a" },
        },
      },
      legend: {
        data: ["Cumulative Check-ins", `Per ${checkinChartData.intervalLabel}`],
        textStyle: { color: "#a1a1aa", fontSize: 12 },
        top: 0,
        left: "center",
        itemGap: 20,
        icon: "roundRect",
        itemWidth: 14,
        itemHeight: 8,
      },
      grid: { top: 40, right: 56, bottom: 80, left: 56, containLabel: false },
      xAxis: {
        type: "time" as const,
        axisLabel: { color: "#71717a", fontSize: 10, hideOverlap: true },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
      },
      yAxis: [
        {
          type: "value" as const,
          name: "Cumulative",
          nameTextStyle: {
            color: "#71717a",
            fontSize: 10,
            padding: [0, 0, 0, -24],
          },
          axisLabel: { color: "#71717a", fontSize: 10 },
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: {
            lineStyle: { color: "#27272a", type: "dashed" as const },
          },
          minInterval: 1,
        },
        {
          type: "value" as const,
          name: `Per ${checkinChartData.intervalLabel}`,
          nameTextStyle: {
            color: "#71717a",
            fontSize: 10,
            padding: [0, -24, 0, 0],
          },
          axisLabel: { color: "#71717a", fontSize: 10 },
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { show: false },
          minInterval: 1,
        },
      ],
      dataZoom: [
        {
          type: "inside" as const,
          xAxisIndex: 0,
          filterMode: "none" as const,
          zoomOnMouseWheel: true,
          moveOnMouseMove: true,
          ...zoomProps,
        },
        {
          type: "slider" as const,
          xAxisIndex: 0,
          filterMode: "none" as const,
          height: 24,
          bottom: 8,
          borderColor: "#3f3f46",
          backgroundColor: "#18181b",
          fillerColor: "rgba(16,185,129,0.15)",
          handleStyle: { color: "#10b981", borderColor: "#10b981" },
          dataBackground: {
            lineStyle: { color: "#3f3f46" },
            areaStyle: { color: "#27272a" },
          },
          selectedDataBackground: {
            lineStyle: { color: "#10b981" },
            areaStyle: { color: "rgba(16,185,129,0.15)" },
          },
          textStyle: { color: "#71717a", fontSize: 10 },
          moveHandleStyle: { color: "#3f3f46" },
          ...zoomProps,
        },
      ],
      series: [
        {
          name: `Per ${checkinChartData.intervalLabel}`,
          type: "bar" as const,
          yAxisIndex: 1,
          data: checkinBars,
          itemStyle: {
            color: "rgba(16,185,129,0.35)",
            borderRadius: [3, 3, 0, 0],
          },
          emphasis: { itemStyle: { color: "#34d399" } },
          barMaxWidth: 28,
          z: 1,
        },
        {
          name: "Visible Avg",
          type: "line" as const,
          yAxisIndex: 1,
          data: checkinChartData.bucketed.map(([ts]) => [
            ts,
            visibleCheckinAverageBucketRate,
          ]),
          symbol: "none",
          showSymbol: false,
          silent: true,
          tooltip: { show: false },
          lineStyle: { width: 1.5, color: "#fb923c", type: "dashed" as const },
          endLabel: {
            show: true,
            formatter: `Avg ${visibleCheckinAverageRate.toFixed(1)}/min`,
            color: "#fdba74",
            fontSize: 11,
          },
          z: 2,
        },
        {
          name: "Cumulative Check-ins",
          type: "line" as const,
          yAxisIndex: 0,
          data: checkinLine,
          smooth: true,
          symbol: "none",
          lineStyle: { width: 2, color: "#10b981" },
          areaStyle: {
            color: {
              type: "linear" as const,
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(16,185,129,0.15)" },
                { offset: 1, color: "rgba(16,185,129,0)" },
              ],
            },
          },
          markLine:
            markerLines.length > 0
              ? {
                  symbol: "none",
                  data: markerLines,
                }
              : undefined,
          z: 2,
        },
      ],
    };
  }, [
    checkinChartData,
    doorsOpenMs,
    effectiveCheckinZoomRange,
    eventStartMs,
    visibleCheckinAverageBucketRate,
    visibleCheckinAverageRate,
  ]);

  // ── Chart: Sales outcome by purchase timing ──

  const purchaseRange = useMemo(
    () =>
      buildPurchaseRange({
        ticketEpochs,
        canceledPurchaseEpochs,
        salesOpenMs,
      }),
    [ticketEpochs, canceledPurchaseEpochs, salesOpenMs],
  );

  const defaultPurchaseZoomRange = useMemo(
    () => buildDefaultPurchaseZoomRange({ purchaseRange, salesOpenMs }),
    [purchaseRange, salesOpenMs],
  );

  const effectivePurchaseZoomRange =
    purchaseZoomRange ?? defaultPurchaseZoomRange;

  const purchaseTimingChartData = useMemo(
    () =>
      buildPurchaseTimingChartData({
        purchaseRange,
        effectivePurchaseZoomRange,
        ticketEpochs,
        scannedPurchaseEpochs,
        canceledPurchaseEpochs,
        canceledMode,
      }),
    [
      purchaseRange,
      effectivePurchaseZoomRange,
      ticketEpochs,
      scannedPurchaseEpochs,
      canceledPurchaseEpochs,
      canceledMode,
    ],
  );

  const onPurchaseDataZoom = useCallback(() => {
    clearTimeout(purchaseDebounceRef.current);
    purchaseDebounceRef.current = setTimeout(() => {
      const instance = purchaseChartRef.current?.getEchartsInstance();
      const fullRange = purchaseRange
        ? [purchaseRange.rangeStart, purchaseRange.rangeEnd]
        : null;
      if (!instance || !fullRange) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const opt = instance.getOption() as any;
      const dz = opt.dataZoom?.[0];
      if (!dz) return;

      let next: [number, number] | null = null;
      if (dz.startValue != null && dz.endValue != null) {
        next = [dz.startValue, dz.endValue];
      } else if (dz.start != null && dz.end != null) {
        const span = fullRange[1] - fullRange[0];
        next = [
          fullRange[0] + (dz.start / 100) * span,
          fullRange[0] + (dz.end / 100) * span,
        ];
      }
      if (!next) return;
      // Skip no-op updates (e.g. programmatic re-render) to avoid churn.
      setPurchaseZoomRange((prev) =>
        prev &&
        Math.abs(prev[0] - next![0]) < 1 &&
        Math.abs(prev[1] - next![1]) < 1
          ? prev
          : next,
      );
    }, 120);
  }, [purchaseRange]);

  const purchaseOnEvents = useMemo(
    () => ({ datazoom: onPurchaseDataZoom }),
    [onPurchaseDataZoom],
  );

  const purchaseChartOption = useMemo(() => {
    if (!purchaseTimingChartData) return null;

    const soldName = `Sold per ${purchaseTimingChartData.intervalLabel}`;

    const zoomProps = effectivePurchaseZoomRange
      ? {
          startValue: effectivePurchaseZoomRange[0],
          endValue: effectivePurchaseZoomRange[1],
        }
      : {};

    const markerLines = [
      salesOpenMs != null
        ? {
            xAxis: salesOpenMs,
            label: {
              formatter: "Sales open",
              color: "#e4e4e7",
              fontSize: 10,
              position: "insideEndTop",
            },
            lineStyle: { color: "#22d3ee", type: "dashed" as const },
          }
        : null,
      salesOpenMs != null
        ? {
            xAxis: salesOpenMs + DAY,
            label: {
              formatter: "+24h",
              color: "#e4e4e7",
              fontSize: 10,
              position: "insideEndBottom",
            },
            lineStyle: { color: "#52525b", type: "dashed" as const },
          }
        : null,
      eventStartMs != null
        ? {
            xAxis: eventStartMs,
            label: {
              formatter: "Event",
              color: "#e4e4e7",
              fontSize: 10,
              position: "insideEndTop",
            },
            lineStyle: { color: "#71717a", type: "dashed" as const },
          }
        : null,
    ].filter(
      (
        value,
      ): value is {
        xAxis: number;
        label: {
          formatter: string;
          color: string;
          fontSize: number;
          position: string;
        };
        lineStyle: { color: string; type: "dashed" };
      } => value !== null,
    );

    const markLine =
      markerLines.length > 0
        ? { symbol: "none" as const, data: markerLines }
        : undefined;

    // Cumulative composition drawn as a 100% stacked area: the bands sum to the
    // full height at every x, so their relative thickness *is* the split.
    const band = (
      name: string,
      color: string,
      fill: string,
      lineData: [number, number, number, number][],
      extra: Record<string, unknown> = {},
    ) => ({
      name,
      type: "line" as const,
      yAxisIndex: 0,
      data: lineData,
      stack: "composition",
      smooth: false,
      showSymbol: false,
      connectNulls: true,
      lineStyle: { width: 1, color },
      areaStyle: { color: fill },
      itemStyle: { color },
      emphasis: { focus: "series" as const },
      z: 2,
      ...extra,
    });

    const compositionBands = [
      // Show-up sits on the bottom of the stack; the marker lines ride on it.
      band(
        "Showed up",
        "#10b981",
        "rgba(16,185,129,0.55)",
        purchaseTimingChartData.rateLine,
        markLine ? { markLine } : {},
      ),
      ...(purchaseTimingChartData.noShowLine
        ? [
            band(
              "No-show",
              "#f43f5e",
              "rgba(244,63,94,0.5)",
              purchaseTimingChartData.noShowLine,
            ),
          ]
        : []),
      ...(purchaseTimingChartData.canceledLine
        ? [
            band(
              "Canceled",
              "#f59e0b",
              "rgba(245,158,11,0.5)",
              purchaseTimingChartData.canceledLine,
            ),
          ]
        : []),
      ...(purchaseTimingChartData.missLine
        ? [
            band(
              "Missed (no-show + canceled)",
              "#f43f5e",
              "rgba(244,63,94,0.5)",
              purchaseTimingChartData.missLine,
            ),
          ]
        : []),
    ];

    const legendData = [...compositionBands.map((s) => s.name), soldName];

    return {
      backgroundColor: "transparent",
      animation: true,
      tooltip: {
        trigger: "axis" as const,
        backgroundColor: "#18181b",
        borderColor: "#3f3f46",
        borderWidth: 1,
        textStyle: { color: "#fafafa", fontSize: 12 },
        axisPointer: {
          type: "cross" as const,
          crossStyle: { color: "#71717a" },
        },
        formatter: (
          params: { axisValue: number; seriesName: string; value: number[] }[],
        ) => {
          if (!params.length) return "";
          const header = formatTimestamp(
            new Date(params[0].axisValue).toISOString(),
          );
          const rows = params.map((p) => {
            if (p.seriesName === soldName) {
              return `Sold: <b>${p.value[1] ?? 0}</b>`;
            }
            // Every rate line carries [ts, pct, count, denom].
            return `${p.seriesName}: <b>${(p.value[1] ?? 0).toFixed(0)}%</b> (${p.value[2] ?? 0}/${p.value[3] ?? 0})`;
          });
          return `<b>${header}</b><br/>${rows.join("<br/>")}`;
        },
      },
      legend: {
        data: legendData,
        textStyle: { color: "#a1a1aa", fontSize: 12 },
        top: 0,
        left: "center",
        itemGap: 20,
        icon: "roundRect",
        itemWidth: 14,
        itemHeight: 8,
      },
      grid: { top: 40, right: 56, bottom: 80, left: 56, containLabel: false },
      xAxis: {
        type: "time" as const,
        // Pin to the full extent so the slider/zoom always span the whole sales
        // window even though the series only buckets the visible window.
        min: purchaseTimingChartData.rangeStart,
        max: purchaseTimingChartData.rangeEnd,
        axisLabel: { color: "#71717a", fontSize: 10, hideOverlap: true },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
      },
      yAxis: [
        {
          type: "value" as const,
          name: "Share of sales",
          min: 0,
          max: 100,
          nameTextStyle: {
            color: "#71717a",
            fontSize: 10,
            padding: [0, 0, 0, -24],
          },
          axisLabel: {
            color: "#71717a",
            fontSize: 10,
            formatter: "{value}%",
          },
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: {
            lineStyle: { color: "#27272a", type: "dashed" as const },
          },
        },
        {
          type: "value" as const,
          name: `Sold per ${purchaseTimingChartData.intervalLabel}`,
          nameTextStyle: {
            color: "#71717a",
            fontSize: 10,
            padding: [0, -24, 0, 0],
          },
          axisLabel: { color: "#71717a", fontSize: 10 },
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { show: false },
          minInterval: 1,
        },
      ],
      dataZoom: [
        {
          type: "inside" as const,
          xAxisIndex: 0,
          filterMode: "none" as const,
          zoomOnMouseWheel: true,
          moveOnMouseMove: true,
          ...zoomProps,
        },
        {
          type: "slider" as const,
          xAxisIndex: 0,
          filterMode: "none" as const,
          height: 24,
          bottom: 8,
          borderColor: "#3f3f46",
          backgroundColor: "#18181b",
          fillerColor: "rgba(16,185,129,0.15)",
          handleStyle: { color: "#10b981", borderColor: "#10b981" },
          dataBackground: {
            lineStyle: { color: "#3f3f46" },
            areaStyle: { color: "#27272a" },
          },
          selectedDataBackground: {
            lineStyle: { color: "#10b981" },
            areaStyle: { color: "rgba(16,185,129,0.15)" },
          },
          textStyle: { color: "#71717a", fontSize: 10 },
          moveHandleStyle: { color: "#3f3f46" },
          ...zoomProps,
        },
      ],
      series: [
        {
          name: `Sold per ${purchaseTimingChartData.intervalLabel}`,
          type: "bar" as const,
          yAxisIndex: 1,
          data: purchaseTimingChartData.soldBars,
          itemStyle: {
            color: "rgba(59,130,246,0.28)",
            borderRadius: [3, 3, 0, 0],
          },
          emphasis: { itemStyle: { color: "#60a5fa" } },
          barMaxWidth: 28,
          z: 1,
        },
        ...compositionBands,
      ],
    };
  }, [
    purchaseTimingChartData,
    effectivePurchaseZoomRange,
    salesOpenMs,
    eventStartMs,
  ]);

  // ── Loading / Error states ──

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <div className="flex items-center gap-3 text-zinc-400">
          <div className="w-5 h-5 border-2 border-zinc-600 border-t-zinc-400 rounded-full animate-spin" />
          <span className="text-sm">Loading summary...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <div className="text-center">
          <InformationCircleIcon
            className="size-4 shrink-0 text-rose-400 mx-auto mb-2 w-10 h-10"
            aria-hidden="true"
          />
          <p className="text-rose-400 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!data || data.totalTickets === 0) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <div className="text-center">
          <CheckCircleIcon
            className="size-4 shrink-0 text-zinc-600 mx-auto mb-2 w-10 h-10"
            aria-hidden="true"
          />
          <p className="text-zinc-400 text-sm">No ticket data for this event</p>
        </div>
      </div>
    );
  }

  const {
    totalTickets,
    scannedCount,
    unscannedCount,
    flakeRate,
    byType,
    waitlistCount,
    averageArrivalOffsetMs,
    peakInterval,
    capacity,
    standbyEnabled,
    scannerLeaderboard,
    earlyBirdFlake,
    referralAttendance,
    arrivalDistribution,
    feedbackStats,
  } = data;

  const attendanceRate =
    totalTickets > 0 ? (scannedCount / totalTickets) * 100 : 0;
  const capacityFill = capacity > 0 ? (scannedCount / capacity) * 100 : 0;

  // VIP vs Standard show-up comparison
  const vipShowUp =
    byType.VIP.total > 0 ? (byType.VIP.scanned / byType.VIP.total) * 100 : null;
  const stdShowUp =
    byType.STANDARD.total > 0
      ? (byType.STANDARD.scanned / byType.STANDARD.total) * 100
      : null;
  const standbyConversion =
    byType.STANDBY.total > 0
      ? (byType.STANDBY.scanned / byType.STANDBY.total) * 100
      : null;
  const visibleTypeCards = TYPE_CONFIG.filter(
    ({ key }) => byType[key].total > 0,
  );
  const summaryBigNumberCardCount = 4;
  const summaryTypeCardCount = visibleTypeCards.length;
  const summaryInsightCardCount = [
    vipShowUp != null && stdShowUp != null,
    standbyEnabled && standbyConversion != null,
    Boolean(earlyBirdFlake),
    Boolean(referralAttendance),
    waitlistCount > 0,
    true,
  ].filter(Boolean).length;
  const summaryFeedbackCardCount = 4;

  return (
    <div className="space-y-5">
      {/* ── Big numbers row ── */}
      <div
        className="grid grid-cols-2 gap-4 analytics-card-grid"
        style={getAnalyticsCardGridStyle(summaryBigNumberCardCount)}
      >
        {/* Attendance */}
        <Card className="p-5">
          <p className="text-xs font-semibold tracking-wide text-zinc-500 mb-2">
            Attendance
          </p>
          <p
            className={`text-3xl font-bold ${attendanceRate >= 75 ? "text-emerald-400" : attendanceRate >= 50 ? "text-blue-400" : "text-amber-400"}`}
          >
            {attendanceRate.toFixed(1)}%
          </p>
          <p className="text-sm text-zinc-400 mt-1">
            {scannedCount} / {totalTickets} showed up
          </p>
          {capacity > 0 && (
            <p className="text-xs text-zinc-500 mt-0.5">
              {capacityFill.toFixed(1)}% of {capacity} capacity
            </p>
          )}
          <div className="mt-3">
            <ProgressBar
              value={scannedCount}
              max={totalTickets}
              color={
                attendanceRate >= 75
                  ? "#10b981"
                  : attendanceRate >= 50
                    ? "#3b82f6"
                    : "#f59e0b"
              }
            />
          </div>
        </Card>

        {/* Flake rate */}
        <Card className="p-5">
          <p className="text-xs font-semibold tracking-wide text-zinc-500 mb-2">
            Flake rate
          </p>
          <p
            className={`text-3xl font-bold ${flakeRate <= 15 ? "text-emerald-400" : flakeRate <= 30 ? "text-amber-400" : "text-rose-400"}`}
          >
            {flakeRate.toFixed(1)}%
          </p>
          <p className="text-sm text-zinc-400 mt-1">
            {unscannedCount} no-shows
          </p>
          <div className="mt-3">
            <ProgressBar
              value={unscannedCount}
              max={totalTickets}
              color={
                flakeRate <= 15
                  ? "#10b981"
                  : flakeRate <= 30
                    ? "#f59e0b"
                    : "#f43f5e"
              }
            />
          </div>
        </Card>

        {/* Avg arrival */}
        <Card className="p-5">
          <p className="text-xs font-semibold tracking-wide text-zinc-500 mb-2">
            Avg arrival
          </p>
          {averageArrivalOffsetMs != null ? (
            <>
              <p className="text-3xl font-bold text-blue-400">
                {formatDuration(averageArrivalOffsetMs)}
              </p>
              <p className="text-sm text-zinc-400 mt-1">after doors open</p>
            </>
          ) : (
            <p className="text-xl text-zinc-600">N/A</p>
          )}
        </Card>

        {/* Peak check-in */}
        <Card className="p-5">
          <p className="text-xs font-semibold tracking-wide text-zinc-500 mb-2">
            Peak window
          </p>
          {peakInterval ? (
            <>
              <p className="text-3xl font-bold text-violet-400">
                {peakInterval.count}
              </p>
              <p className="text-sm text-zinc-400 mt-1">check-ins in 15 min</p>
              <p className="text-xs text-zinc-500 mt-0.5">
                {formatTimeRange(peakInterval.start, peakInterval.end)}
              </p>
            </>
          ) : (
            <p className="text-xl text-zinc-600">N/A</p>
          )}
        </Card>
      </div>

      <div
        className="grid grid-cols-2 gap-4 analytics-card-grid"
        style={getAnalyticsCardGridStyle(summaryFeedbackCardCount)}
      >
        <Card className="p-5">
          <p className="text-xs font-semibold tracking-wide text-zinc-500 mb-2">
            Feedback NPS
          </p>
          {feedbackStats.nps != null ? (
            <>
              <p
                className={`text-3xl font-bold ${feedbackStats.nps >= 40 ? "text-emerald-400" : feedbackStats.nps >= 0 ? "text-blue-400" : "text-rose-400"}`}
              >
                {Math.round(feedbackStats.nps)}
              </p>
              <p className="text-sm text-zinc-400 mt-1">
                {feedbackStats.promoterCount} promoters &middot;{" "}
                {feedbackStats.detractorCount} detractors
              </p>
            </>
          ) : (
            <>
              <p className="text-3xl font-bold text-zinc-600">N/A</p>
              <p className="text-sm text-zinc-400 mt-1">
                No feedback responses yet
              </p>
            </>
          )}
        </Card>

        <Card className="p-5">
          <p className="text-xs font-semibold tracking-wide text-zinc-500 mb-2">
            Feedback response rate
          </p>
          <p
            className={`text-3xl font-bold ${feedbackStats.responseRate >= 35 ? "text-emerald-400" : feedbackStats.responseRate >= 15 ? "text-amber-400" : "text-zinc-300"}`}
          >
            {feedbackStats.responseRate.toFixed(1)}%
          </p>
          <p className="text-sm text-zinc-400 mt-1">
            {feedbackStats.responseCount} of {scannedCount} checked-in attendees
          </p>
          <div className="mt-3">
            <ProgressBar
              value={feedbackStats.responseCount}
              max={Math.max(scannedCount, 1)}
              color={
                feedbackStats.responseRate >= 35
                  ? "#10b981"
                  : feedbackStats.responseRate >= 15
                    ? "#f59e0b"
                    : "#71717a"
              }
            />
          </div>
        </Card>

        <Card className="p-5">
          <p className="text-xs font-semibold tracking-wide text-zinc-500 mb-2">
            Average score
          </p>
          {feedbackStats.averageScore != null ? (
            <>
              <p className="text-3xl font-bold text-cyan-400">
                {feedbackStats.averageScore.toFixed(1)}
                <span className="text-lg text-zinc-500">/10</span>
              </p>
              <p className="text-sm text-zinc-400 mt-1">
                {feedbackStats.passiveCount} passives in the middle
              </p>
            </>
          ) : (
            <>
              <p className="text-3xl font-bold text-zinc-600">N/A</p>
              <p className="text-sm text-zinc-400 mt-1">
                Waiting on first response
              </p>
            </>
          )}
        </Card>

        <Card className="p-5">
          <p className="text-xs font-semibold tracking-wide text-zinc-500 mb-2">
            Written comments
          </p>
          <p className="text-3xl font-bold text-violet-400">
            {feedbackStats.commentCount}
          </p>
          <p className="text-sm text-zinc-400 mt-1">
            {feedbackStats.responseCount > 0
              ? `${((feedbackStats.commentCount / feedbackStats.responseCount) * 100).toFixed(0)}% of responses included notes`
              : "No comments yet"}
          </p>
        </Card>
      </div>

      {/* ── Per-type flake breakdown ── */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-zinc-300 mb-4">
          Attendance by ticket type
        </h3>
        <div
          className="grid grid-cols-2 gap-4 analytics-card-grid"
          style={getAnalyticsCardGridStyle(summaryTypeCardCount)}
        >
          {visibleTypeCards.map(({ key, label, color, bg, text }) => {
            const t = byType[key];
            const showRate = t.total > 0 ? (t.scanned / t.total) * 100 : 0;
            const flaked = t.total - t.scanned;
            return (
              <div key={key} className={`rounded-lg border p-4 ${bg}`}>
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`text-xs font-semibold tracking-wide ${text}`}
                  >
                    {label}
                  </span>
                  <span className={`text-lg font-bold ${text}`}>
                    {showRate.toFixed(0)}%
                  </span>
                </div>
                <p className="text-sm text-zinc-300 mb-1">
                  {t.scanned} / {t.total} attended
                </p>
                <p className="text-xs text-zinc-500 mb-2">
                  {flaked} flaked ({t.flakeRate.toFixed(0)}%)
                </p>
                <ProgressBar value={t.scanned} max={t.total} color={color} />
              </div>
            );
          })}
        </div>
      </Card>

      {/* ── Arrival Distribution ── */}
      {arrivalDistribution && arrivalDistribution.total > 0 && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-zinc-300 mb-4">
            Arrival distribution
          </h3>
          <ReactECharts
            option={{
              backgroundColor: "transparent",
              animation: true,
              animationDuration: 600,
              animationEasing: "cubicOut",
              grid: {
                top: 16,
                right: 16,
                bottom: 24,
                left: 16,
                containLabel: true,
              },
              xAxis: {
                type: "category",
                data: arrivalDistribution.buckets.map((b) => b.label),
                axisLabel: { color: "#a1a1aa", fontSize: 11 },
                axisLine: { show: false },
                axisTick: { show: false },
              },
              yAxis: {
                type: "value",
                axisLabel: { color: "#71717a", fontSize: 10 },
                axisLine: { show: false },
                axisTick: { show: false },
                splitLine: { lineStyle: { color: "#27272a", type: "dashed" } },
                minInterval: 1,
              },
              tooltip: {
                trigger: "axis",
                backgroundColor: "#18181b",
                borderColor: "#3f3f46",
                borderWidth: 1,
                textStyle: { color: "#fafafa", fontSize: 12 },
                formatter: (params: { name: string; value: number }[]) => {
                  const p = params[0];
                  const pct =
                    arrivalDistribution.total > 0
                      ? ((p.value / arrivalDistribution.total) * 100).toFixed(0)
                      : "0";
                  return `<b>${p.name}</b><br/>${p.value} (${pct}%)`;
                },
              },
              series: [
                {
                  type: "bar",
                  barWidth: "60%",
                  data: arrivalDistribution.buckets.map(({ count }, i) => ({
                    value: count,
                    itemStyle: {
                      color: {
                        type: "linear",
                        x: 0,
                        y: 0,
                        x2: 0,
                        y2: 1,
                        colorStops: [
                          {
                            offset: 0,
                            color: ARRIVAL_COLORS[i % ARRIVAL_COLORS.length],
                          },
                          {
                            offset: 1,
                            color:
                              ARRIVAL_COLORS[i % ARRIVAL_COLORS.length] + "33",
                          },
                        ],
                      },
                      borderRadius: [8, 8, 0, 0],
                    },
                  })),
                  label: {
                    show: true,
                    position: "top",
                    color: "#a1a1aa",
                    fontSize: 11,
                    fontWeight: "bold",
                    formatter: (p: { value: number }) => String(p.value),
                  },
                },
              ],
            }}
            style={{ height: 200 }}
            opts={{ renderer: "canvas" }}
          />
        </Card>
      )}

      {/* ── Sales outcome by purchase timing ── */}
      {purchaseChartOption && (
        <Card className="p-5">
          <div className="flex items-start justify-between gap-3 mb-1">
            <h3 className="text-sm font-semibold text-zinc-300">
              Sales outcome by purchase timing
            </h3>
            {canceledPurchaseEpochs.length > 0 && (
              <div className="inline-flex shrink-0 rounded-lg border border-zinc-800 bg-zinc-900/60 p-0.5">
                {(
                  [
                    ["separate", "Separate"],
                    ["as-noshow", "As no-shows"],
                    ["exclude", "Exclude"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setCanceledMode(value)}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      canceledMode === value
                        ? "bg-zinc-700 text-zinc-100"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className="text-[10px] text-zinc-600 mb-3">
            {canceledPurchaseEpochs.length === 0
              ? "Of the tickets bought in each interval, the share who showed up vs no-showed. Zoom in for finer intervals; the window defaults to sales open — scroll to zoom, drag to pan."
              : canceledMode === "separate"
                ? "Of the tickets bought in each interval, the share who showed up vs no-showed vs canceled — stacked to 100%. Compare the launch window against later buyers."
                : canceledMode === "as-noshow"
                  ? "Of the tickets bought in each interval, the share who showed up vs missed (no-show + canceled), stacked to 100%. The honest “what % actually showed up”, since people often cancel weeks later."
                  : "Of the tickets bought in each interval, showed up vs no-showed among live tickets only (canceled excluded)."}
          </p>
          <ReactECharts
            ref={purchaseChartRef}
            option={purchaseChartOption}
            style={{ height: 350 }}
            opts={{ renderer: "canvas" }}
            onEvents={purchaseOnEvents}
          />
        </Card>
      )}

      {/* ── Insights row ── */}
      <div
        className="grid grid-cols-1 sm:grid-cols-2 gap-4 analytics-card-grid"
        style={getAnalyticsCardGridStyle(summaryInsightCardCount)}
      >
        {vipShowUp != null && stdShowUp != null && (
          <Card className="p-4">
            <p className="text-xs font-semibold tracking-wide text-zinc-500 mb-2">
              VIP vs standard
            </p>
            <div className="flex items-end gap-3">
              <div>
                <p className="text-xs text-violet-400 mb-0.5">VIP</p>
                <p className="text-xl font-bold text-violet-400">
                  {vipShowUp.toFixed(0)}%
                </p>
              </div>
              <div className="text-zinc-600 text-sm pb-0.5">vs</div>
              <div>
                <p className="text-xs text-blue-400 mb-0.5">Standard</p>
                <p className="text-xl font-bold text-blue-400">
                  {stdShowUp.toFixed(0)}%
                </p>
              </div>
            </div>
          </Card>
        )}

        {standbyEnabled && standbyConversion != null && (
          <Card className="p-4">
            <p className="text-xs font-semibold tracking-wide text-zinc-500 mb-2">
              Standby conversion
            </p>
            <p className="text-xl font-bold text-amber-400">
              {standbyConversion.toFixed(0)}%
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              {byType.STANDBY.scanned} / {byType.STANDBY.total} admitted
            </p>
          </Card>
        )}

        {/* Early-bird flake */}
        {earlyBirdFlake && (
          <Card className="p-4">
            <p className="text-xs font-semibold tracking-wide text-zinc-500 mb-2">
              Early vs late buyers
            </p>
            <div className="flex items-end gap-3">
              <div>
                <p className="text-xs text-emerald-400 mb-0.5">
                  First 24h ({earlyBirdFlake.earlyTotal})
                </p>
                <p className="text-xl font-bold text-emerald-400">
                  {earlyBirdFlake.earlyFlakeRate.toFixed(0)}%
                </p>
              </div>
              <div className="text-zinc-600 text-sm pb-0.5">vs</div>
              <div>
                <p className="text-xs text-rose-400 mb-0.5">
                  Last 24h ({earlyBirdFlake.lateTotal})
                </p>
                <p className="text-xl font-bold text-rose-400">
                  {earlyBirdFlake.lateFlakeRate.toFixed(0)}%
                </p>
              </div>
            </div>
            <p className="text-[10px] text-zinc-600 mt-1">
              flake rate: early buyers vs last-minute
            </p>
          </Card>
        )}

        {/* Referral attendance */}
        {referralAttendance && (
          <Card className="p-4">
            <p className="text-xs font-semibold tracking-wide text-zinc-500 mb-2">
              Referral attendance
            </p>
            <div className="flex items-end gap-3">
              <div>
                <p className="text-xs text-cyan-400 mb-0.5">
                  Referral ({referralAttendance.referralTotal})
                </p>
                <p className="text-xl font-bold text-cyan-400">
                  {referralAttendance.referralShowRate.toFixed(0)}%
                </p>
              </div>
              <div className="text-zinc-600 text-sm pb-0.5">vs</div>
              <div>
                <p className="text-xs text-zinc-400 mb-0.5">
                  Organic ({referralAttendance.organicTotal})
                </p>
                <p className="text-xl font-bold text-zinc-300">
                  {referralAttendance.organicShowRate.toFixed(0)}%
                </p>
              </div>
            </div>
            <p className="text-[10px] text-zinc-600 mt-1">
              show-up rate comparison
            </p>
          </Card>
        )}

        {waitlistCount > 0 && (
          <Card className="p-4">
            <p className="text-xs font-semibold tracking-wide text-zinc-500 mb-2">
              Waitlist size
            </p>
            <p className="text-xl font-bold text-rose-400">{waitlistCount}</p>
            <p className="text-xs text-zinc-500 mt-1">people who missed out</p>
          </Card>
        )}

        <Card className="p-4">
          <p className="text-xs font-semibold tracking-wide text-zinc-500 mb-2">
            Tickets sold
          </p>
          <p className="text-xl font-bold text-blue-400">{totalTickets}</p>
          {capacity > 0 && (
            <p className="text-xs text-zinc-500 mt-1">
              {((totalTickets / capacity) * 100).toFixed(0)}% of capacity
            </p>
          )}
        </Card>
      </div>

      {feedbackStats.recentComments.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-zinc-300">
              Recent feedback comments
            </h3>
            <span className="text-xs text-zinc-500">
              {feedbackStats.commentCount} total comment
              {feedbackStats.commentCount !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="space-y-3">
            {feedbackStats.recentComments.map((entry) => (
              <div
                key={entry.id}
                className="rounded-lg border border-white/10 bg-zinc-950/60 p-4"
              >
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="inline-flex items-center rounded-full bg-violet-500/10 px-2.5 py-1 text-xs font-semibold text-violet-300">
                    {entry.score}/10
                  </span>
                  <span className="text-sm font-medium text-white">
                    {entry.attendeeName ||
                      entry.attendeeEmail ||
                      "Anonymous attendee"}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {formatTimestamp(entry.updatedAt)}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-zinc-300 whitespace-pre-wrap">
                  {entry.comment}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Scanner Performance ── */}
      {scannerLeaderboard.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-zinc-300">
              Scanner performance
            </h3>
            <div className="flex items-center gap-4 text-xs text-zinc-500">
              <span>
                {scannerLeaderboard.length} scanner
                {scannerLeaderboard.length !== 1 ? "s" : ""}
              </span>
              <span>
                {scannedCount > 0
                  ? Math.round(scannedCount / scannerLeaderboard.length)
                  : 0}{" "}
                avg scans
              </span>
            </div>
          </div>
          <div className="space-y-3">
            {scannerLeaderboard.map((scanner, i) => {
              const pct =
                scannedCount > 0 ? (scanner.count / scannedCount) * 100 : 0;
              return (
                <div
                  key={scanner.email || scanner.name}
                  className="flex items-center gap-3"
                >
                  <span
                    className={`text-sm font-bold w-6 text-right ${i < 3 ? ["text-amber-400", "text-zinc-300", "text-amber-600"][i] : "text-zinc-500"}`}
                  >
                    #{i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-white truncate">
                        {scanner.name}
                      </span>
                      <span className="text-xs text-zinc-400 shrink-0 ml-2">
                        {scanner.count} ({pct.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${(scanner.count / scannerLeaderboard[0].count) * 100}%`,
                          backgroundColor:
                            i === 0
                              ? "#f59e0b"
                              : i === 1
                                ? "#a1a1aa"
                                : i === 2
                                  ? "#b45309"
                                  : "#3b82f6",
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* ── Booking and Check-in timelines ── */}
      {(salesChartOption || checkinChartOption) && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {salesChartOption && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-zinc-300 mb-1">
                Ticket sales timeline
              </h3>
              <p className="text-[10px] text-zinc-600 mb-3">
                Booking pace over the full sales window, separate from event-day
                arrivals.
              </p>
              <ReactECharts
                option={salesChartOption}
                style={{ height: 320 }}
                opts={{ renderer: "canvas" }}
              />
            </Card>
          )}

          {checkinChartOption && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-zinc-300 mb-1">
                Check-in timeline
              </h3>
              <p className="text-[10px] text-zinc-600 mb-3">
                Event-day scan activity around doors open and start time. Scroll
                to zoom and drag to pan.
              </p>
              <ReactECharts
                ref={checkinChartRef}
                option={checkinChartOption}
                style={{ height: 350 }}
                opts={{ renderer: "canvas" }}
                onEvents={checkinOnEvents}
              />
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

// ── Wrapper ──────────────────────────────────────────────────────────────

export default function SummaryClient() {
  const { events, selectedEventId } = useEventContext();
  const currentEvent = events.find((e) => e.id === selectedEventId);

  return (
    <div className="px-4 sm:px-6 py-8 space-y-6">
      <PageHeader
        title="Summary"
        subtitle={
          currentEvent ? currentEvent.name || "Unnamed Event" : undefined
        }
      />

      {!selectedEventId ? (
        <EmptyState
          title="No event selected"
          hint="Select an event from the sidebar to view summary data"
        />
      ) : (
        <SummaryContent eventId={selectedEventId} />
      )}
    </div>
  );
}
