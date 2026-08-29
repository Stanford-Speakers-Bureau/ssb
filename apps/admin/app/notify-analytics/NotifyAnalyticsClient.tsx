"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { InformationCircleIcon } from "@heroicons/react/16/solid";
import { useEventContext } from "@/app/EventContext";
import ReactECharts from "echarts-for-react";
import { Card, EmptyState, PageHeader } from "@/app/components/ui";

// ── Types ────────────────────────────────────────────────────────────────

type CrossPollinationItem = {
  eventId: string;
  eventName: string | null;
  sharedCount: number;
};

type AnalyticsResponse = {
  eventName: string | null;
  releaseDate: string | null;
  ticketingDate: string | null;
  totalSignups: number;
  uniqueSignups: number;
  ticketHolders: number;
  conversionRate: number;
  timestamps: string[];
  affiliations: string[][];
  crossPollinatedPeople: number;
  crossPollination: CrossPollinationItem[];
};

// ── Bucketing helpers (same as TicketSalesGraph) ─────────────────────────

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

// ── Affiliation helpers ──────────────────────────────────────────────────

const AFFILIATION_CATEGORIES = [
  { key: "student", label: "Student", color: "#3b82f6" },
  { key: "faculty", label: "Faculty", color: "#8b5cf6" },
  { key: "staff", label: "Staff", color: "#10b981" },
  { key: "postdoc", label: "Postdoc", color: "#06b6d4" },
  { key: "alum", label: "Alum", color: "#f59e0b" },
  { key: "other", label: "Other", color: "#71717a" },
] as const;

const KNOWN_AFFILIATIONS: Set<string> = new Set(
  AFFILIATION_CATEGORIES.filter((c) => c.key !== "other").map((c) => c.key),
);

function classifyAffiliation(affiliation: string): string {
  const lower = affiliation.toLowerCase();
  if (KNOWN_AFFILIATIONS.has(lower)) return lower;
  // Map common compound affiliations
  if (lower.includes("student")) return "student";
  if (lower.includes("faculty")) return "faculty";
  if (lower.includes("staff")) return "staff";
  return "other";
}

type AffiliationBucket = {
  ts: number;
  counts: Record<string, number>;
  cumulative: Record<string, number>;
};

function bucketAffiliations(
  epochs: number[],
  affiliations: string[][],
  intervalMs: number,
  rangeStart: number,
  rangeEnd: number,
): AffiliationBucket[] {
  const alignedStart = Math.floor(rangeStart / intervalMs) * intervalMs;
  const result: AffiliationBucket[] = [];
  const cumulative: Record<string, number> = {};
  for (const cat of AFFILIATION_CATEGORIES) cumulative[cat.key] = 0;

  let idx = 0;
  // Count before visible range
  while (idx < epochs.length && epochs[idx] < alignedStart) {
    const category = getTopCategoryForSignup(affiliations[idx]);
    cumulative[category] = (cumulative[category] ?? 0) + 1;
    idx++;
  }

  let bucketStart = alignedStart;
  while (bucketStart <= rangeEnd) {
    const bucketEnd = bucketStart + intervalMs;
    const counts: Record<string, number> = {};
    for (const cat of AFFILIATION_CATEGORIES) counts[cat.key] = 0;

    while (idx < epochs.length && epochs[idx] < bucketEnd) {
      const category = getTopCategoryForSignup(affiliations[idx]);
      counts[category] = (counts[category] ?? 0) + 1;
      cumulative[category] = (cumulative[category] ?? 0) + 1;
      idx++;
    }

    result.push({
      ts: bucketStart,
      counts,
      cumulative: { ...cumulative },
    });
    bucketStart = bucketEnd;
  }

  return result;
}

function getTopCategoryForSignup(affiliations: string[]): string {
  if (affiliations.length === 0) return "other";
  const categories = new Set(affiliations.map(classifyAffiliation));
  for (const category of AFFILIATION_CATEGORIES) {
    if (categories.has(category.key)) {
      return category.key;
    }
  }
  return "other";
}

// ── Main Component ───────────────────────────────────────────────────────

export default function NotifyAnalyticsClient() {
  const { events, selectedEventId } = useEventContext();
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Zoom state for signups chart
  const [zoomRange, setZoomRange] = useState<[number, number] | null>(null);
  const chartRef = useRef<ReactECharts>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const currentEvent = events.find((e) => e.id === selectedEventId);

  useEffect(() => {
    if (!selectedEventId) {
      setData(null);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();

    async function fetchData() {
      setIsLoading(true);
      setError(null);
      setZoomRange(null);
      try {
        const res = await fetch(
          `/api/notify/analytics?eventId=${selectedEventId}`,
          { signal: controller.signal },
        );
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to fetch analytics");
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
  }, [selectedEventId]);

  // ── Pre-parse timestamps, filtered to release date ──
  const releaseEpoch = useMemo(() => {
    if (!data?.releaseDate) return null;
    return new Date(data.releaseDate).getTime();
  }, [data]);

  const { epochs, filteredAffiliations } = useMemo(() => {
    if (!data) return { epochs: [], filteredAffiliations: [] as string[][] };
    const allEpochs = data.timestamps.map((t) => new Date(t).getTime());
    if (releaseEpoch == null) {
      return { epochs: allEpochs, filteredAffiliations: data.affiliations };
    }
    const ep: number[] = [];
    const af: string[][] = [];
    for (let i = 0; i < allEpochs.length; i++) {
      if (allEpochs[i] >= releaseEpoch) {
        ep.push(allEpochs[i]);
        af.push(data.affiliations[i]);
      }
    }
    return { epochs: ep, filteredAffiliations: af };
  }, [data, releaseEpoch]);

  const fullRange = useMemo<[number, number]>(() => {
    if (epochs.length === 0) return [Date.now(), Date.now()];
    const start = releaseEpoch ?? epochs[0];
    return [start, Math.max(epochs[epochs.length - 1], start + MIN)];
  }, [epochs, releaseEpoch]);

  const visibleRange = zoomRange ?? fullRange;
  const visibleSpan = visibleRange[1] - visibleRange[0];

  // ── Signups over time chart data ──
  const { bucketedData, seriesLabel } = useMemo(() => {
    if (epochs.length === 0)
      return {
        bucketedData: [] as [number, number, number][],
        seriesLabel: "Minute",
      };
    const interval = pickInterval(Math.max(visibleSpan, MIN));
    return {
      bucketedData: bucketEpochs(epochs, interval, fullRange[0], fullRange[1]),
      seriesLabel: intervalLabel(interval),
    };
  }, [epochs, fullRange, visibleSpan]);

  // ── Affiliation chart data ──
  const affiliationBuckets = useMemo(() => {
    if (!data || epochs.length === 0) return [];
    const interval = pickInterval(Math.max(visibleSpan, MIN));
    return bucketAffiliations(
      epochs,
      filteredAffiliations,
      interval,
      fullRange[0],
      fullRange[1],
    );
  }, [data, epochs, fullRange, visibleSpan]);

  // ── Zoom handler ──
  const onDataZoom = useCallback(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const instance = chartRef.current?.getEchartsInstance();
      if (!instance) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const opt = instance.getOption() as any;
      const dz = opt.dataZoom?.[0];
      if (!dz) return;

      if (dz.startValue != null && dz.endValue != null) {
        setZoomRange([dz.startValue, dz.endValue]);
      } else if (dz.start != null && dz.end != null) {
        const span = fullRange[1] - fullRange[0];
        setZoomRange([
          fullRange[0] + (dz.start / 100) * span,
          fullRange[0] + (dz.end / 100) * span,
        ]);
      }
    }, 120);
  }, [fullRange]);

  const onEvents = useMemo(() => ({ datazoom: onDataZoom }), [onDataZoom]);

  // ── Signups chart option ──
  const signupsChartOption = useMemo(() => {
    if (bucketedData.length === 0) return {};

    const barData = bucketedData.map(([ts, sold]) => [ts, sold]);
    const lineData = bucketedData.map(([ts, , cum]) => [ts, cum]);
    const zoomProps = zoomRange
      ? { startValue: zoomRange[0], endValue: zoomRange[1] }
      : {};

    return {
      backgroundColor: "transparent",
      animation: false,
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
        data: ["Cumulative", `Per ${seriesLabel}`],
        textStyle: { color: "#a1a1aa", fontSize: 12 },
        top: 0,
        left: "center",
        itemGap: 24,
        icon: "roundRect",
        itemWidth: 14,
        itemHeight: 8,
      },
      grid: {
        top: 40,
        right: 56,
        bottom: 80,
        left: 56,
        containLabel: false,
      },
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
          name: `Per ${seriesLabel}`,
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
          fillerColor: "rgba(59,130,246,0.15)",
          handleStyle: { color: "#3b82f6", borderColor: "#3b82f6" },
          dataBackground: {
            lineStyle: { color: "#3f3f46" },
            areaStyle: { color: "#27272a" },
          },
          selectedDataBackground: {
            lineStyle: { color: "#3b82f6" },
            areaStyle: { color: "rgba(59,130,246,0.15)" },
          },
          textStyle: { color: "#71717a", fontSize: 10 },
          moveHandleStyle: { color: "#3f3f46" },
          ...zoomProps,
        },
      ],
      series: [
        {
          name: `Per ${seriesLabel}`,
          type: "bar" as const,
          yAxisIndex: 1,
          data: barData,
          itemStyle: {
            color: "rgba(16,185,129,0.5)",
            borderRadius: [2, 2, 0, 0],
          },
          emphasis: { itemStyle: { color: "#10b981" } },
          barMaxWidth: 28,
          large: true,
          z: 1,
        },
        {
          name: "Cumulative",
          type: "line" as const,
          yAxisIndex: 0,
          data: lineData,
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
                { offset: 0, color: "rgba(59,130,246,0.25)" },
                { offset: 1, color: "rgba(59,130,246,0)" },
              ],
            },
          },
          z: 2,
        },
      ],
    };
  }, [bucketedData, seriesLabel, zoomRange]);

  // ── Affiliation chart option ──
  const affiliationChartOption = useMemo(() => {
    if (affiliationBuckets.length === 0) return {};

    return {
      backgroundColor: "transparent",
      animation: false,
      tooltip: {
        trigger: "axis" as const,
        backgroundColor: "#18181b",
        borderColor: "#3f3f46",
        borderWidth: 1,
        textStyle: { color: "#fafafa", fontSize: 12 },
      },
      legend: {
        data: AFFILIATION_CATEGORIES.map((c) => c.label),
        textStyle: { color: "#a1a1aa", fontSize: 12 },
        top: 0,
        left: "center",
        itemGap: 16,
        icon: "roundRect",
        itemWidth: 14,
        itemHeight: 8,
      },
      grid: {
        top: 40,
        right: 24,
        bottom: 24,
        left: 56,
        containLabel: false,
      },
      xAxis: {
        type: "time" as const,
        axisLabel: { color: "#71717a", fontSize: 10, hideOverlap: true },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value" as const,
        axisLabel: { color: "#71717a", fontSize: 10 },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: {
          lineStyle: { color: "#27272a", type: "dashed" as const },
        },
        minInterval: 1,
      },
      series: AFFILIATION_CATEGORIES.map((cat) => ({
        name: cat.label,
        type: "line" as const,
        stack: "affiliations",
        areaStyle: { opacity: 0.6 },
        emphasis: { focus: "series" as const },
        data: affiliationBuckets.map((b) => [b.ts, b.cumulative[cat.key] ?? 0]),
        lineStyle: { width: 1, color: cat.color },
        itemStyle: { color: cat.color },
        symbol: "none",
      })),
    };
  }, [affiliationBuckets]);

  // ── Student percentage ──
  const studentStats = useMemo(() => {
    if (!data || data.totalSignups === 0) return { count: 0, pct: 0 };
    let count = 0;
    for (const affs of data.affiliations) {
      if (affs.some((a) => classifyAffiliation(a) === "student")) {
        count++;
      }
    }
    return {
      count,
      pct: (count / data.totalSignups) * 100,
    };
  }, [data]);

  // ── Render ─────────────────────────────────────────────────────────────

  if (!selectedEventId) {
    return (
      <div className="px-4 sm:px-6 py-8">
        <PageHeader title="Notify analytics" className="mb-8" />
        <EmptyState
          title="No event selected"
          hint="Select an event from the sidebar to view notify analytics"
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="px-4 sm:px-6 py-8">
        <PageHeader
          title="Notify analytics"
          subtitle={
            currentEvent ? currentEvent.name || "Unnamed Event" : undefined
          }
          className="mb-8"
        />
        <div className="flex items-center justify-center py-20">
          <div className="flex items-center gap-3 text-zinc-400">
            <div className="w-5 h-5 border-2 border-zinc-600 border-t-zinc-400 rounded-full animate-spin" />
            <span className="text-sm">Loading notify analytics...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 sm:px-6 py-8">
        <PageHeader title="Notify analytics" className="mb-8" />
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <InformationCircleIcon className="size-4 shrink-0 text-rose-400 mx-auto mb-2 w-10 h-10" aria-hidden="true" />
            <p className="text-rose-400 text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data || data.totalSignups === 0) {
    return (
      <div className="px-4 sm:px-6 py-8">
        <PageHeader
          title="Notify analytics"
          subtitle={
            currentEvent ? currentEvent.name || "Unnamed Event" : undefined
          }
          className="mb-8"
        />
        <EmptyState title="No notify signups yet" />
      </div>
    );
  }

  const maxSharedCount =
    data.crossPollination.length > 0 ? data.crossPollination[0].sharedCount : 0;

  return (
    <div className="px-4 sm:px-6 py-8">
      <PageHeader
        title="Notify analytics"
        subtitle={
          currentEvent ? currentEvent.name || "Unnamed Event" : undefined
        }
        className="mb-8"
      />

      <div className="space-y-5">
        {/* Stat Cards */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-zinc-900/60 px-4 py-3">
            <p className="text-xs font-medium tracking-wide text-zinc-400">
              Total signups
            </p>
            <p className="mt-2 text-2xl font-bold text-blue-400">
              {data.totalSignups}
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              {data.uniqueSignups} unique emails
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-zinc-900/60 px-4 py-3">
            <p className="text-xs font-medium tracking-wide text-zinc-400">
              Conversion rate
            </p>
            <p
              className={`mt-2 text-2xl font-bold ${
                data.conversionRate >= 50
                  ? "text-emerald-400"
                  : data.conversionRate >= 25
                    ? "text-blue-400"
                    : "text-amber-400"
              }`}
            >
              {data.conversionRate.toFixed(1)}%
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              {data.ticketHolders} got tickets
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-zinc-900/60 px-4 py-3">
            <p className="text-xs font-medium tracking-wide text-zinc-400">
              Students
            </p>
            <p className="mt-2 text-2xl font-bold text-violet-400">
              {studentStats.pct.toFixed(1)}%
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              {studentStats.count} of {data.totalSignups} signups
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-zinc-900/60 px-4 py-3">
            <p className="text-xs font-medium tracking-wide text-zinc-400">
              Cross-pollination
            </p>
            <p className="mt-2 text-2xl font-bold text-rose-400">
              {data.crossPollinatedPeople}
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              people overlap with {data.crossPollination.length} past
              {data.crossPollination.length === 1
                ? " event audience"
                : " event audiences"}
            </p>
          </div>
        </div>

        {/* Signups Over Time Chart */}
        <Card className="p-5 sm:p-5">
          <h3 className="text-sm font-semibold text-white mb-1">
            Signups over time
          </h3>
          <p className="text-[10px] text-zinc-600 mb-1">
            Scroll to zoom &middot; Drag to pan &middot; Click legend to toggle
          </p>
          <ReactECharts
            ref={chartRef}
            option={signupsChartOption}
            style={{ height: 400 }}
            opts={{ renderer: "canvas" }}
            onEvents={onEvents}
            notMerge
          />
        </Card>

        {/* Affiliation Breakdown Over Time */}
        <Card className="p-5 sm:p-5">
          <h3 className="text-sm font-semibold text-white mb-1">
            Affiliation breakdown over time
          </h3>
          <p className="text-[10px] text-zinc-600 mb-3">
            Cumulative signups by primary affiliation type
          </p>
          <ReactECharts
            option={affiliationChartOption}
            style={{ height: 350 }}
            opts={{ renderer: "canvas" }}
            notMerge
          />
        </Card>

        {/* Cross-Pollination */}
        <Card className="p-5 sm:p-5">
          <h3 className="text-sm font-semibold text-white mb-1">
            Cross-pollination
          </h3>
          <p className="text-[10px] text-zinc-600 mb-4">
            Past event audiences whose notify lists or ticket holders overlap
            with this event&apos;s audience
          </p>
          {data.crossPollination.length === 0 ? (
            <p className="text-zinc-500 text-sm py-4 text-center">
              No overlap with past event audiences
            </p>
          ) : (
            <div className="space-y-2">
              {data.crossPollination.map((item) => (
                <div
                  key={item.eventId}
                  className="flex items-center gap-3 py-1.5"
                >
                  <span className="text-sm text-zinc-300 flex-1 truncate">
                    {item.eventName || "Unnamed Event"}
                  </span>
                  <span className="text-sm text-zinc-400 tabular-nums w-12 text-right">
                    {item.sharedCount}
                  </span>
                  <div className="w-32 bg-white/10 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-rose-500/70 transition-all duration-500"
                      style={{
                        width: `${maxSharedCount > 0 ? (item.sharedCount / maxSharedCount) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
