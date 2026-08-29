"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowTrendingUpIcon,
  BoltIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationCircleIcon,
  StarIcon,
} from "@heroicons/react/16/solid";
import { useEventContext } from "@/app/EventContext";
import {
  getAnalyticsCardGridStyle,
  getDefaultTimelineZoomRange,
} from "@/app/lib/utils";
import ReactECharts from "echarts-for-react";
import { PageHeader, SegmentedControl, StatusPill } from "@/app/components/ui";

// ── Types ────────────────────────────────────────────────────────────────

type TypeKey = "STANDARD" | "VIP" | "EXTERNAL" | "STANDBY";
type AffiliationKey = "student" | "staff" | "faculty" | "member" | "unknown";

type Breakdown = { total: number; scanned: number };

type ScanEvent = {
  name: string | null;
  type: string | null;
  scanTime: string;
  scannedBy: string | null;
  scannerKey: string;
};

type ScannerEntry = { name: string; email: string; count: number };

type CheckInResponse = {
  scanEvents: ScanEvent[];
  scanTimestamps: string[];
  totalTickets: number;
  scannedCount: number;
  isLive: boolean;
  capacity: number;
  doorsOpen: string | null;
  startTime: string | null;
  standbyEnabled: boolean;
  waitlistCount: number;
  byType: Record<TypeKey, Breakdown>;
  byAffiliation: Record<AffiliationKey, Breakdown>;
  standbyTimestamps: string[];
  scannerLeaderboard: ScannerEntry[];
  peakScansPerMin: number;
};

type ParsedScanEvent = ScanEvent & {
  epoch: number;
  scannerName: string;
  typeKey: TypeKey;
};

type TimelineMode = "scanner" | "type";

type BucketedTimelinePoint = {
  timestamp: number;
  total: number;
  cumulative: number;
  groups: Record<string, number>;
};

type TimelineSeries = {
  key: string;
  label: string;
  color: string;
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

function bucketGroupedEvents(
  events: ParsedScanEvent[],
  intervalMs: number,
  rangeStart: number,
  rangeEnd: number,
  getGroupKey: (event: ParsedScanEvent) => string,
): BucketedTimelinePoint[] {
  const alignedStart = Math.floor(rangeStart / intervalMs) * intervalMs;
  const result: BucketedTimelinePoint[] = [];
  let cumulative = 0;
  let idx = 0;

  while (idx < events.length && events[idx].epoch < alignedStart) {
    cumulative++;
    idx++;
  }

  let bucketStart = alignedStart;
  while (bucketStart <= rangeEnd) {
    const bucketEnd = bucketStart + intervalMs;
    const groups: Record<string, number> = {};
    let total = 0;

    while (idx < events.length && events[idx].epoch < bucketEnd) {
      const groupKey = getGroupKey(events[idx]);
      groups[groupKey] = (groups[groupKey] ?? 0) + 1;
      total++;
      idx++;
    }

    cumulative += total;
    result.push({
      timestamp: bucketStart,
      total,
      cumulative,
      groups,
    });
    bucketStart = bucketEnd;
  }

  return result;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Los_Angeles",
  });
}

function formatDuration(ms: number): string {
  const mins = Math.floor(ms / 60_000);
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  if (hrs > 0) return `${hrs}h ${remainMins}m`;
  return `${mins}m`;
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
    <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
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
    ring: "ring-blue-500/30",
    bg: "bg-blue-500/10",
    text: "text-blue-400",
  },
  {
    key: "VIP" as const,
    label: "VIP",
    color: "#8b5cf6",
    ring: "ring-violet-500/30",
    bg: "bg-violet-500/10",
    text: "text-violet-400",
  },
  {
    key: "EXTERNAL" as const,
    label: "External",
    color: "#10b981",
    ring: "ring-emerald-500/30",
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
  },
  {
    key: "STANDBY" as const,
    label: "Standby",
    color: "#f59e0b",
    ring: "ring-amber-500/30",
    bg: "bg-amber-500/10",
    text: "text-amber-400",
  },
];

const AFFILIATION_CONFIG = [
  {
    key: "student" as const,
    label: "Student",
    color: "#3b82f6",
    bg: "bg-blue-500/10",
    text: "text-blue-400",
  },
  {
    key: "staff" as const,
    label: "Staff",
    color: "#10b981",
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
  },
  {
    key: "faculty" as const,
    label: "Faculty",
    color: "#8b5cf6",
    bg: "bg-violet-500/10",
    text: "text-violet-400",
  },
  {
    key: "member" as const,
    label: "Member",
    color: "#f59e0b",
    bg: "bg-amber-500/10",
    text: "text-amber-400",
  },
  {
    key: "unknown" as const,
    label: "Unknown",
    color: "#71717a",
    bg: "bg-zinc-800/80",
    text: "text-zinc-300",
  },
];

const TYPE_BADGE: Record<string, string> = {
  STANDARD: "bg-blue-500/20 text-blue-300",
  VIP: "bg-violet-500/20 text-violet-300",
  EXTERNAL: "bg-emerald-500/20 text-emerald-300",
  STANDBY: "bg-amber-500/20 text-amber-300",
};

const SCANNER_COLORS = [
  "#f59e0b",
  "#3b82f6",
  "#10b981",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#f97316",
  "#84cc16",
  "#eab308",
  "#6366f1",
];

const EMPTY_SCANNER_LEADERBOARD: ScannerEntry[] = [];
const RECENT_SCAN_PAGE_SIZE = 25;

function normalizeTypeKey(type: string | null): TypeKey {
  const normalized = type?.toUpperCase() ?? "STANDARD";
  if (normalized === "VIP") return "VIP";
  if (normalized === "EXTERNAL") return "EXTERNAL";
  if (normalized === "STANDBY") return "STANDBY";
  return "STANDARD";
}

// ── Main Component ───────────────────────────────────────────────────────

function CheckInContent({ eventId }: { eventId: string }) {
  const { events, updateEvent } = useEventContext();
  const router = useRouter();

  const [data, setData] = useState<CheckInResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [isTogglingLive, setIsTogglingLive] = useState(false);
  const [isTogglingIdVerify, setIsTogglingIdVerify] = useState(false);
  const [isTogglingStandby, setIsTogglingStandby] = useState(false);

  const [timelineMode, setTimelineMode] = useState<TimelineMode>("scanner");
  const [zoomRange, setZoomRange] = useState<[number, number] | null>(null);
  const [visibleRecentCount, setVisibleRecentCount] = useState(
    RECENT_SCAN_PAGE_SIZE,
  );
  const chartRef = useRef<ReactECharts>(null);
  const standbyChartRef = useRef<ReactECharts>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pollRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const currentEvent = events.find((e) => e.id === eventId);
  const isLive = currentEvent?.live ?? false;
  const isIdVerifyEnabled = currentEvent?.identityVerificationEnabled ?? true;
  const isAdmittingStandby = currentEvent?.allowAdmittingStandby ?? false;
  const scannerLeaderboard =
    data?.scannerLeaderboard ?? EMPTY_SCANNER_LEADERBOARD;
  const scannedCount = data?.scannedCount ?? 0;

  const fetchData = useCallback(
    async (showLoading = false) => {
      try {
        if (showLoading) setIsLoading(true);
        setError(null);
        const res = await fetch(`/api/events/${eventId}/checkin`);
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to fetch check-in data");
        }
        const json: CheckInResponse = await res.json();
        setData(json);
        return json;
      } catch (err) {
        console.error("Error fetching check-in data:", err);
        setError(err instanceof Error ? err.message : "Failed to load data");
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [eventId],
  );

  // Initial fetch + polling
  useEffect(() => {
    let cancelled = false;
    fetchData(true).then((result) => {
      if (cancelled) return;
      if (result?.isLive) {
        setIsPolling(true);
        pollRef.current = setInterval(() => {
          if (!cancelled) fetchData(false);
        }, 15_000);
      }
    });
    return () => {
      cancelled = true;
      clearInterval(pollRef.current);
      pollRef.current = undefined;
      setIsPolling(false);
    };
  }, [fetchData]);

  // Sync polling with live status
  useEffect(() => {
    if (isLive && !pollRef.current) {
      setIsPolling(true);
      pollRef.current = setInterval(() => fetchData(false), 15_000);
    } else if (!isLive && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = undefined;
      setIsPolling(false);
    }
  }, [isLive, fetchData]);

  useEffect(() => {
    setZoomRange(null);
    setVisibleRecentCount(RECENT_SCAN_PAGE_SIZE);
  }, [eventId]);

  async function handleToggleLive() {
    if (!eventId) return;
    setIsTogglingLive(true);
    try {
      const newLive = !isLive;
      const res = await fetch("/api/events", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: eventId, live: newLive }),
      });
      const result = await res.json();
      if (res.ok && result.event) {
        updateEvent(eventId, { live: newLive });
        if (newLive) {
          events.forEach((e) => {
            if (e.id !== eventId && e.live) updateEvent(e.id, { live: false });
          });
        }
        router.refresh();
        fetchData(false);
      } else {
        setError(result.error || "Failed to update live status");
      }
    } catch {
      setError("Failed to update live status");
    } finally {
      setIsTogglingLive(false);
    }
  }

  async function handleToggleIdVerify() {
    if (!eventId) return;
    setIsTogglingIdVerify(true);
    try {
      const newVal = !isIdVerifyEnabled;
      const res = await fetch("/api/events", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: eventId, identityVerificationEnabled: newVal }),
      });
      const result = await res.json();
      if (res.ok && result.event) {
        updateEvent(eventId, { identityVerificationEnabled: newVal });
      } else {
        setError(result.error || "Failed to update identity verification");
      }
    } catch {
      setError("Failed to update identity verification");
    } finally {
      setIsTogglingIdVerify(false);
    }
  }

  async function handleToggleAdmittingStandby() {
    if (!eventId) return;
    setIsTogglingStandby(true);
    try {
      const newVal = !isAdmittingStandby;
      const res = await fetch("/api/events", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: eventId, allowAdmittingStandby: newVal }),
      });
      const result = await res.json();
      if (res.ok && result.event) {
        updateEvent(eventId, { allowAdmittingStandby: newVal });
      } else {
        setError(result.error || "Failed to update standby admission");
      }
    } catch {
      setError("Failed to update standby admission");
    } finally {
      setIsTogglingStandby(false);
    }
  }

  // ── Chart data ──

  const parsedScanEvents = useMemo(() => {
    if (!data) return [];
    return data.scanEvents
      .map((scan) => ({
        ...scan,
        epoch: new Date(scan.scanTime).getTime(),
        scannerName: scan.scannedBy || "Unknown",
        typeKey: normalizeTypeKey(scan.type),
      }))
      .sort((a, b) => a.epoch - b.epoch);
  }, [data]);

  const scanEpochs = useMemo(
    () => parsedScanEvents.map((scan) => scan.epoch),
    [parsedScanEvents],
  );

  const recentScans = useMemo(
    () => [...parsedScanEvents].sort((a, b) => b.epoch - a.epoch),
    [parsedScanEvents],
  );

  useEffect(() => {
    setVisibleRecentCount((current) => {
      if (recentScans.length === 0) return RECENT_SCAN_PAGE_SIZE;
      return Math.min(
        Math.max(current, RECENT_SCAN_PAGE_SIZE),
        recentScans.length,
      );
    });
  }, [recentScans.length]);

  const visibleRecentScans = useMemo(
    () => recentScans.slice(0, visibleRecentCount),
    [recentScans, visibleRecentCount],
  );

  const scannerTimelineSeries = useMemo<TimelineSeries[]>(() => {
    const orderedSeries = scannerLeaderboard.map((scanner, index) => ({
      key: scanner.email || scanner.name || "unknown",
      label: scanner.name || "Unknown",
      color: SCANNER_COLORS[index % SCANNER_COLORS.length],
    }));

    const seenKeys = new Set(orderedSeries.map((series) => series.key));
    for (const scan of parsedScanEvents) {
      if (seenKeys.has(scan.scannerKey)) continue;
      orderedSeries.push({
        key: scan.scannerKey,
        label: scan.scannerName,
        color: SCANNER_COLORS[orderedSeries.length % SCANNER_COLORS.length],
      });
      seenKeys.add(scan.scannerKey);
    }

    return orderedSeries;
  }, [parsedScanEvents, scannerLeaderboard]);

  const typeTimelineSeries = useMemo<TimelineSeries[]>(
    () =>
      TYPE_CONFIG.filter(({ key }) => data?.byType[key].scanned).map(
        ({ key, label, color }) => ({ key, label, color }),
      ),
    [data],
  );

  const doorsOpenMs = useMemo(
    () => (data?.doorsOpen ? new Date(data.doorsOpen).getTime() : null),
    [data?.doorsOpen],
  );

  const eventStartMs = useMemo(
    () => (data?.startTime ? new Date(data.startTime).getTime() : null),
    [data?.startTime],
  );

  const fullRange = useMemo<[number, number]>(() => {
    if (scanEpochs.length === 0) return [Date.now(), Date.now()];
    const anchorStart = doorsOpenMs ?? eventStartMs ?? scanEpochs[0];
    const rangeStart = Math.min(scanEpochs[0], anchorStart - 15 * MIN);
    const rangeEnd = Math.max(
      scanEpochs[scanEpochs.length - 1],
      eventStartMs != null ? eventStartMs + 90 * MIN : anchorStart + 2 * HOUR,
      rangeStart + MIN,
    );
    return [rangeStart, rangeEnd];
  }, [doorsOpenMs, eventStartMs, scanEpochs]);

  const defaultZoomRange = useMemo<[number, number] | null>(() => {
    if (scanEpochs.length === 0) return null;
    return getDefaultTimelineZoomRange({
      rangeStart: fullRange[0],
      rangeEnd: fullRange[1],
      doorsOpenMs,
      eventStartMs,
      paddingMs: 0,
    });
  }, [doorsOpenMs, eventStartMs, fullRange, scanEpochs.length]);

  const visibleRange = zoomRange ?? defaultZoomRange ?? fullRange;
  const visibleSpan = visibleRange[1] - visibleRange[0];

  const { bucketedData, intervalMs, seriesLabel } = useMemo(() => {
    if (parsedScanEvents.length === 0) {
      return {
        bucketedData: [] as BucketedTimelinePoint[],
        intervalMs: MIN,
        seriesLabel: "Minute",
      };
    }

    const interval = pickInterval(Math.max(visibleSpan, MIN));
    return {
      bucketedData: bucketGroupedEvents(
        parsedScanEvents,
        interval,
        fullRange[0],
        fullRange[1],
        (scan) => (timelineMode === "scanner" ? scan.scannerKey : scan.typeKey),
      ),
      intervalMs: interval,
      seriesLabel: intervalLabel(interval),
    };
  }, [parsedScanEvents, fullRange, timelineMode, visibleSpan]);

  const timelineSeries =
    timelineMode === "scanner" ? scannerTimelineSeries : typeTimelineSeries;

  // Scan velocity: scans in last 5 minutes
  const scanVelocity = useMemo(() => {
    if (!data || scanEpochs.length === 0) return 0;
    const fiveMinAgo = Date.now() - 5 * MIN;
    const recent = scanEpochs.filter((e) => e >= fiveMinAgo).length;
    return Math.round(recent / 5);
  }, [data, scanEpochs]);

  // Time since doors opened
  const doorsDuration = useMemo(() => {
    if (!data?.doorsOpen) return null;
    const doorsMs = new Date(data.doorsOpen).getTime();
    const diff = Date.now() - doorsMs;
    return diff > 0 ? diff : null;
  }, [data]);

  // Estimated completion time
  const estimatedCompletion = useMemo(() => {
    if (!data || scanVelocity <= 0) return null;
    const remaining = data.totalTickets - data.scannedCount;
    if (remaining <= 0) return null;
    return Math.ceil(remaining / scanVelocity);
  }, [data, scanVelocity]);

  const averageScanRate = useMemo(() => {
    if (scannedCount === 0 || scanEpochs.length === 0) return 0;

    const rangeStart = doorsOpenMs ?? scanEpochs[0];
    const rangeEnd = Math.max(
      eventStartMs != null ? Math.min(Date.now(), eventStartMs) : Date.now(),
      rangeStart + MIN,
    );
    const elapsedMinutes = Math.max((rangeEnd - rangeStart) / MIN, 1);
    const scansInWindow = scanEpochs.filter(
      (epoch) => epoch >= rangeStart && epoch <= rangeEnd,
    ).length;

    return scansInWindow / elapsedMinutes;
  }, [doorsOpenMs, eventStartMs, scanEpochs, scannedCount]);

  const visibleAverageScanRate = useMemo(() => {
    if (scanEpochs.length === 0) return 0;
    const scansInWindow = scanEpochs.filter(
      (epoch) => epoch >= visibleRange[0] && epoch <= visibleRange[1],
    ).length;
    const elapsedMinutes = Math.max(
      (visibleRange[1] - visibleRange[0]) / MIN,
      1,
    );

    return scansInWindow / elapsedMinutes;
  }, [scanEpochs, visibleRange]);

  const visibleAverageBucketRate = useMemo(
    () => visibleAverageScanRate * (intervalMs / MIN),
    [intervalMs, visibleAverageScanRate],
  );

  const scannerShareChartOption = useMemo(() => {
    if (scannerLeaderboard.length === 0) return null;

    return {
      backgroundColor: "transparent",
      animation: false,
      tooltip: {
        trigger: "item" as const,
        backgroundColor: "#18181b",
        borderColor: "#3f3f46",
        borderWidth: 1,
        textStyle: { color: "#fafafa", fontSize: 12 },
        formatter: (params: { name: string; value: number; percent: number }) =>
          `<b>${params.name}</b><br/>${params.value} scans (${params.percent}%)`,
      },
      legend: {
        type: "scroll" as const,
        orient: "vertical" as const,
        top: "middle",
        right: 0,
        textStyle: { color: "#a1a1aa", fontSize: 11 },
        pageIconColor: "#10b981",
        pageTextStyle: { color: "#71717a" },
      },
      graphic: [
        {
          type: "group",
          left: "28%",
          top: "50%",
          z: 10,
          children: [
            {
              type: "text",
              x: 0,
              y: -12,
              style: {
                text: `${scannedCount}`,
                textAlign: "center",
                textVerticalAlign: "middle",
                fill: "#fafafa",
                fontSize: 24,
                fontWeight: 700,
              },
            },
            {
              type: "text",
              x: 0,
              y: 18,
              style: {
                text: "scans",
                textAlign: "center",
                textVerticalAlign: "middle",
                fill: "#d4d4d8",
                fontSize: 16,
                fontWeight: 600,
              },
            },
          ],
        },
      ],
      series: [
        {
          name: "Scanner share",
          type: "pie" as const,
          radius: ["48%", "74%"],
          center: ["28%", "50%"],
          avoidLabelOverlap: true,
          itemStyle: {
            borderColor: "#09090b",
            borderWidth: 2,
          },
          label: {
            show: true,
            color: "#d4d4d8",
            fontSize: 11,
            formatter: (params: { percent: number }) =>
              params.percent >= 8 ? `${params.percent}%` : "",
          },
          labelLine: { show: false },
          emphasis: {
            scale: true,
            scaleSize: 6,
          },
          data: scannerLeaderboard.map((scanner, index) => ({
            value: scanner.count,
            name: scanner.name,
            itemStyle: {
              color: SCANNER_COLORS[index % SCANNER_COLORS.length],
            },
          })),
        },
      ],
    };
  }, [scannedCount, scannerLeaderboard]);

  const handleRecentScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      if (visibleRecentCount >= recentScans.length) return;

      const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
      if (scrollTop + clientHeight < scrollHeight - 48) return;

      setVisibleRecentCount((current) =>
        Math.min(current + RECENT_SCAN_PAGE_SIZE, recentScans.length),
      );
    },
    [recentScans.length, visibleRecentCount],
  );

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

  // Main check-in chart
  const chartOption = useMemo(() => {
    if (bucketedData.length === 0) return {};
    const lineData = bucketedData.map(({ timestamp, cumulative }) => [
      timestamp,
      cumulative,
    ]);
    const markerLines = [
      doorsOpenMs != null
        ? {
            xAxis: doorsOpenMs,
            label: {
              formatter: "Doors",
              color: "#e4e4e7",
              fontSize: 10,
              position: "insideEndTop" as const,
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
              position: "insideEndTop" as const,
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
          position: "insideEndTop";
        };
        lineStyle: { color: string; type: "dashed" };
      } => value !== null,
    );
    const zoomProps = {
      startValue: visibleRange[0],
      endValue: visibleRange[1],
    };

    return {
      backgroundColor: "transparent",
      animation: false,
      tooltip: {
        trigger: "axis" as const,
        backgroundColor: "#18181b",
        borderColor: "#3f3f46",
        borderWidth: 1,
        textStyle: { color: "#fafafa", fontSize: 12 },
        axisPointer: { type: "shadow" as const },
        formatter: (
          params: Array<{
            seriesName: string;
            value: [number, number];
            color: string;
            seriesType: string;
          }>,
        ) => {
          const timestamp = Array.isArray(params[0]?.value)
            ? params[0].value[0]
            : 0;
          const bars = params
            .filter(
              (param) =>
                param.seriesType === "bar" &&
                Array.isArray(param.value) &&
                Number(param.value[1]) > 0,
            )
            .map((param) => ({
              color: param.color,
              label: param.seriesName,
              value: Number(param.value[1]),
            }))
            .sort((a, b) => b.value - a.value);

          const total = bars.reduce((sum, bar) => sum + bar.value, 0);
          const cumulative = params.find(
            (param) => param.seriesName === "Cumulative",
          );
          const cumulativeValue =
            Array.isArray(cumulative?.value) && cumulative
              ? Number(cumulative.value[1])
              : 0;

          return [
            `<b>${new Date(timestamp).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
              timeZone: "America/Los_Angeles",
            })}</b>`,
            `<span style="color:#a1a1aa">${total} scans this ${seriesLabel.toLowerCase()}</span>`,
            `<span style="color:#fb923c">Visible avg: ${visibleAverageScanRate.toFixed(1)}/min</span>`,
            `<span style="color:#93c5fd">Cumulative: ${cumulativeValue}</span>`,
            ...bars.map(
              (bar) =>
                `<span style="color:${bar.color}">${bar.label}: ${bar.value}</span>`,
            ),
          ].join("<br/>");
        },
      },
      legend: {
        type: "scroll" as const,
        data: ["Cumulative", ...timelineSeries.map((series) => series.label)],
        textStyle: { color: "#a1a1aa", fontSize: 11 },
        top: 0,
        left: 0,
        right: 0,
        itemGap: 18,
        icon: "roundRect",
        itemWidth: 14,
        itemHeight: 8,
        pageIconColor: "#10b981",
        pageTextStyle: { color: "#71717a" },
      },
      grid: { top: 62, right: 56, bottom: 80, left: 56, containLabel: false },
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
        ...timelineSeries.map((series) => ({
          name: series.label,
          type: "bar" as const,
          stack: "checkins",
          yAxisIndex: 1,
          data: bucketedData.map(({ timestamp, groups }) => [
            timestamp,
            groups[series.key] ?? 0,
          ]),
          itemStyle: { color: series.color },
          barMaxWidth: 40,
          barMinHeight: 1,
          z: 1,
        })),
        {
          name: "Visible Avg",
          type: "line" as const,
          yAxisIndex: 1,
          data: bucketedData.map(({ timestamp }) => [
            timestamp,
            visibleAverageBucketRate,
          ]),
          symbol: "none",
          showSymbol: false,
          silent: true,
          tooltip: { show: false },
          lineStyle: { width: 1.5, color: "#fb923c", type: "dashed" as const },
          endLabel: {
            show: true,
            formatter: `Avg ${visibleAverageScanRate.toFixed(1)}/min`,
            color: "#fdba74",
            fontSize: 11,
          },
          z: 2,
        },
        {
          name: "Cumulative",
          type: "line" as const,
          yAxisIndex: 0,
          data: lineData,
          smooth: true,
          symbol: "none",
          lineStyle: { width: 2, color: "#e4e4e7" },
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
    bucketedData,
    doorsOpenMs,
    eventStartMs,
    visibleAverageBucketRate,
    visibleAverageScanRate,
    seriesLabel,
    timelineSeries,
    visibleRange,
  ]);

  // Standby growth chart
  const standbyEpochs = useMemo(() => {
    if (!data) return [];
    return data.standbyTimestamps.map((t) => new Date(t).getTime());
  }, [data]);

  const standbyChartOption = useMemo(() => {
    if (standbyEpochs.length === 0) return null;
    const sorted = [...standbyEpochs].sort((a, b) => a - b);
    const lineData = sorted.map((ts, i) => [ts, i + 1]);
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
      grid: { top: 20, right: 20, bottom: 30, left: 50, containLabel: false },
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
        splitLine: { lineStyle: { color: "#27272a", type: "dashed" as const } },
        minInterval: 1,
      },
      series: [
        {
          type: "line" as const,
          data: lineData,
          smooth: true,
          symbol: "none",
          lineStyle: { width: 2, color: "#f59e0b" },
          areaStyle: {
            color: {
              type: "linear" as const,
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(245,158,11,0.25)" },
                { offset: 1, color: "rgba(245,158,11,0)" },
              ],
            },
          },
        },
      ],
    };
  }, [standbyEpochs]);

  // ── Loading / Error states ──

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <div className="flex items-center gap-3 text-zinc-400">
          <div className="w-5 h-5 border-2 border-zinc-600 border-t-zinc-400 rounded-full animate-spin" />
          <span className="text-sm">Loading check-in data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <div className="text-center">
          <ExclamationCircleIcon className="size-10 text-rose-400 mx-auto mb-2" aria-hidden="true" />
          <p className="text-rose-400 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { totalTickets, byType, waitlistCount, capacity, peakScansPerMin } =
    data;
  const checkInRate =
    totalTickets > 0 ? (scannedCount / totalTickets) * 100 : 0;
  const capacityRate = capacity > 0 ? (scannedCount / capacity) * 100 : 0;
  const topScanner =
    scannerLeaderboard.length > 0 ? scannerLeaderboard[0] : null;
  const avgScansPerScanner =
    scannerLeaderboard.length > 0
      ? Math.round(scannedCount / scannerLeaderboard.length)
      : 0;
  const visibleTypeCards = TYPE_CONFIG.filter(
    ({ key }) => byType[key].total > 0,
  );
  const typeCardCount = visibleTypeCards.length + (waitlistCount > 0 ? 1 : 0);
  const affiliationCardCount = AFFILIATION_CONFIG.length;

  return (
    <div className="space-y-5">
      {/* ── Top bar: Live toggle + metrics ── */}
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
        {/* Live toggle */}
        <button
          type="button"
          onClick={handleToggleLive}
          disabled={isTogglingLive}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors text-sm disabled:opacity-50 ${
            isLive
              ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-inset ring-emerald-500/30 hover:bg-emerald-500/30"
              : "bg-white/5 text-zinc-400 ring-1 ring-inset ring-white/10 hover:bg-white/10"
          }`}
        >
          <div
            className={`w-8 h-4 rounded-full relative transition-colors ${isLive ? "bg-emerald-500" : "bg-zinc-600"}`}
          >
            <div
              className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${isLive ? "translate-x-4" : "translate-x-0.5"}`}
            />
          </div>
          {isLive ? "Live" : "Not Live"}
        </button>

        {/* ID verification toggle */}
        <button
          type="button"
          onClick={handleToggleIdVerify}
          disabled={isTogglingIdVerify}
          title="Require identity verification before admitting guests"
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors text-sm disabled:opacity-50 ${
            isIdVerifyEnabled
              ? "bg-blue-500/20 text-blue-400 ring-1 ring-inset ring-blue-500/30 hover:bg-blue-500/30"
              : "bg-white/5 text-zinc-400 ring-1 ring-inset ring-white/10 hover:bg-white/10"
          }`}
        >
          <div
            className={`w-8 h-4 rounded-full relative transition-colors ${isIdVerifyEnabled ? "bg-blue-500" : "bg-zinc-600"}`}
          >
            <div
              className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${isIdVerifyEnabled ? "translate-x-4" : "translate-x-0.5"}`}
            />
          </div>
          ID Check
        </button>

        {/* Allow admitting standby toggle */}
        <button
          type="button"
          onClick={handleToggleAdmittingStandby}
          disabled={isTogglingStandby}
          title="Allow scanners to admit standby guests"
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors text-sm disabled:opacity-50 ${
            isAdmittingStandby
              ? "bg-amber-500/20 text-amber-400 ring-1 ring-inset ring-amber-500/30 hover:bg-amber-500/30"
              : "bg-white/5 text-zinc-400 ring-1 ring-inset ring-white/10 hover:bg-white/10"
          }`}
        >
          <div
            className={`w-8 h-4 rounded-full relative transition-colors ${isAdmittingStandby ? "bg-amber-500" : "bg-zinc-600"}`}
          >
            <div
              className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${isAdmittingStandby ? "translate-x-4" : "translate-x-0.5"}`}
            />
          </div>
          Admit Standby
        </button>

        <div className="h-8 w-px bg-white/10 hidden sm:block" />

        {/* Scan velocity */}
        <div className="flex items-center gap-2">
          <BoltIcon className="size-4 shrink-0 text-emerald-400" aria-hidden="true" />
          <span className="text-white font-bold text-lg">{scanVelocity}</span>
          <span className="text-zinc-400 text-sm">scans/min</span>
        </div>

        {scannedCount > 0 && (
          <>
            <div className="h-8 w-px bg-white/10 hidden sm:block" />
            <div className="flex items-center gap-2">
              <svg
                className="w-4 h-4 text-cyan-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 10h4l3-7 4 18 3-11h4"
                />
              </svg>
              <span className="text-white font-bold text-lg">
                {averageScanRate.toFixed(1)}
              </span>
              <span className="text-zinc-400 text-sm">avg scans/min</span>
            </div>
          </>
        )}

        {/* Peak scans/min */}
        {peakScansPerMin > 0 && (
          <>
            <div className="h-8 w-px bg-white/10 hidden sm:block" />
            <div className="flex items-center gap-2">
              <ArrowTrendingUpIcon className="size-4 shrink-0 text-violet-400" aria-hidden="true" />
              <span className="text-white font-bold text-lg">
                {peakScansPerMin}
              </span>
              <span className="text-zinc-400 text-sm">peak/min</span>
            </div>
          </>
        )}

        {/* Best scanner */}
        {topScanner && (
          <div className="hidden 2xl:flex items-center gap-4">
            <div className="h-8 w-px bg-white/10" />
            <div className="flex items-center gap-2 min-w-0">
              <StarIcon className="size-4 shrink-0 text-amber-400" aria-hidden="true" />
              <span className="text-white text-sm font-medium truncate max-w-[120px]">
                {topScanner.name}
              </span>
              <span className="text-zinc-400 text-sm">
                ({topScanner.count})
              </span>
            </div>
          </div>
        )}

        {/* Estimated completion */}
        {estimatedCompletion != null && (
          <>
            <div className="h-8 w-px bg-white/10 hidden sm:block" />
            <div className="flex items-center gap-2">
              <ClockIcon className="size-4 shrink-0 text-blue-400" aria-hidden="true" />
              <span className="text-zinc-300 text-sm">
                ~{estimatedCompletion} min left
              </span>
            </div>
          </>
        )}

        {/* Doors duration */}
        {doorsDuration && (
          <div className="hidden 2xl:flex items-center gap-4">
            <div className="h-8 w-px bg-white/10" />
            <div className="flex items-center gap-2">
              <ClockIcon className="size-4 shrink-0 text-zinc-400" aria-hidden="true" />
              <span className="text-zinc-300 text-sm">
                Doors open {formatDuration(doorsDuration)} ago
              </span>
            </div>
          </div>
        )}

        {/* Polling indicator */}
        {isPolling && (
          <>
            <div className="h-8 w-px bg-white/10 hidden sm:block" />
            <div className="flex items-center gap-2 text-xs text-emerald-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              Updating every 15s
            </div>
          </>
        )}
      </div>

      {/* ── Overall check-in rate ── */}
      <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-semibold text-white">
              <span className="tabular-nums">{scannedCount}</span>
              <span className="text-zinc-400 font-normal text-sm">
                {" "}
                / {totalTickets} checked in
              </span>
            </h3>
            {capacity > 0 && (
              <p className="text-xs text-zinc-500 mt-0.5">
                {capacityRate.toFixed(1)}% of venue capacity ({capacity})
              </p>
            )}
          </div>
          <span
            className={`text-3xl font-bold ${checkInRate >= 75 ? "text-emerald-400" : checkInRate >= 40 ? "text-blue-400" : "text-amber-400"}`}
          >
            {checkInRate.toFixed(1)}%
          </span>
        </div>
        <ProgressBar
          value={scannedCount}
          max={totalTickets}
          color={
            checkInRate >= 75
              ? "#10b981"
              : checkInRate >= 40
                ? "#3b82f6"
                : "#f59e0b"
          }
        />
      </div>

      {/* ── Per-type breakdown + waitlist ── */}
      <div
        className="grid grid-cols-2 gap-3 analytics-card-grid"
        style={getAnalyticsCardGridStyle(typeCardCount)}
      >
        {visibleTypeCards.map(({ key, label, color, bg, text }) => {
          const t = byType[key];
          const pct = t.total > 0 ? (t.scanned / t.total) * 100 : 0;
          return (
            <div
              key={key}
              className={`rounded-2xl ring-1 ring-inset ring-white/10 p-4 ${bg}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-medium tracking-wide ${text}`}>
                  {label}
                </span>
                <span className={`text-lg font-bold tabular-nums ${text}`}>
                  {pct.toFixed(0)}%
                </span>
              </div>
              <p className="text-sm text-zinc-300 font-medium mb-2 tabular-nums">
                {t.scanned} / {t.total}
              </p>
              <ProgressBar value={t.scanned} max={t.total} color={color} />
            </div>
          );
        })}
        {/* Waitlist card */}
        {waitlistCount > 0 && (
          <div className="rounded-2xl ring-1 ring-inset ring-white/10 p-4 bg-rose-500/5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium tracking-wide text-rose-400">
                Waitlist
              </span>
              <ClockIcon className="size-4 shrink-0 text-rose-400" aria-hidden="true" />
            </div>
            <p className="text-2xl text-white font-bold tabular-nums">
              {waitlistCount}
            </p>
            <p className="text-xs text-zinc-500 mt-1">people waiting</p>
          </div>
        )}
      </div>

      {/* ── Affiliation breakdown ── */}
      <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-5">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-white">
            Attendance by affiliation
          </h3>
          <p className="mt-1 text-[11px] text-zinc-500">
            Uses each ticket holder&apos;s highest profile affiliation.
            Unmatched profiles are grouped as Unknown.
          </p>
        </div>
        <div
          className="grid grid-cols-2 gap-3 analytics-card-grid"
          style={getAnalyticsCardGridStyle(affiliationCardCount)}
        >
          {AFFILIATION_CONFIG.map(({ key, label, color, bg, text }) => {
            const affiliation = data.byAffiliation[key];
            const pct =
              affiliation.total > 0
                ? (affiliation.scanned / affiliation.total) * 100
                : 0;

            return (
              <div
                key={key}
                className={`rounded-2xl ring-1 ring-inset ring-white/10 p-4 ${bg}`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className={`text-xs font-medium tracking-wide ${text}`}>
                    {label}
                  </span>
                  <span className={`text-lg font-bold tabular-nums ${text}`}>
                    {pct.toFixed(0)}%
                  </span>
                </div>
                <p className="mb-2 text-sm font-medium text-zinc-300 tabular-nums">
                  {affiliation.scanned} / {affiliation.total}
                </p>
                <ProgressBar
                  value={affiliation.scanned}
                  max={affiliation.total}
                  color={color}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Scanner Overview ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {scannerShareChartOption && (
          <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-5 flex h-full min-h-[460px] flex-col">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Scanner leaderboard
                </h3>
                <p className="text-[11px] text-zinc-500 mt-1">
                  {scannerLeaderboard.length} scanner
                  {scannerLeaderboard.length !== 1 ? "s" : ""} ·{" "}
                  {avgScansPerScanner} avg scans
                </p>
              </div>
              {topScanner && (
                <StatusPill color="amber">
                  {topScanner.name} leads with {topScanner.count}
                </StatusPill>
              )}
            </div>
            <div className="flex-1 min-h-[380px]">
              <ReactECharts
                option={scannerShareChartOption}
                style={{ height: "100%" }}
                opts={{ renderer: "canvas" }}
                notMerge
              />
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4 flex h-full min-h-[460px] flex-col">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Recent scans</h3>
              <p className="text-[11px] text-zinc-500 mt-1">
                Showing {Math.min(visibleRecentCount, recentScans.length)} of{" "}
                {recentScans.length} scans
              </p>
            </div>
            {isPolling && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
            )}
          </div>
          {recentScans.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-zinc-600 text-sm min-h-[320px]">
              No scans yet
            </div>
          ) : (
            <>
              <div
                className="flex-1 min-h-0 overflow-y-auto space-y-1.5 max-h-[420px] pr-1"
                onScroll={handleRecentScroll}
              >
                {visibleRecentScans.map((scan, i) => (
                  <div
                    key={`${scan.scanTime}-${i}`}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg bg-white/5 ${
                      i === 0 && isPolling ? "ring-1 ring-emerald-500/30" : ""
                    }`}
                  >
                    <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs font-medium text-zinc-300 shrink-0">
                      {(scan.name || "?")[0].toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white truncate">
                        {scan.name || "Unknown"}
                      </p>
                      <p className="text-[11px] text-zinc-500">
                        {formatTime(scan.scanTime)}
                        <span className="text-zinc-600">
                          {" "}
                          &middot; by {scan.scannerName}
                        </span>
                      </p>
                    </div>
                    <span
                      className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                        TYPE_BADGE[scan.typeKey] ?? TYPE_BADGE.STANDARD
                      }`}
                    >
                      {scan.typeKey === "STANDARD" ? "STD" : scan.typeKey}
                    </span>
                  </div>
                ))}
              </div>
              {visibleRecentCount < recentScans.length && (
                <p className="mt-3 text-center text-[11px] text-zinc-500">
                  Scroll down to load more scans
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Full-width timeline ── */}
      <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-white mb-1">
              Check-in timeline
            </h3>
            <p className="text-[11px] text-zinc-500">
              Stacked scan volume across the event. Toggle between scanner
              activity and ticket types.
            </p>
          </div>
          <SegmentedControl
            aria-label="Timeline grouping"
            options={[
              { value: "scanner", label: "Scanner" },
              { value: "type", label: "Ticket type" },
            ]}
            value={timelineMode}
            onChange={setTimelineMode}
          />
        </div>
        {scanEpochs.length > 0 ? (
          <>
            <div className="flex flex-wrap items-center gap-4 mb-2 text-[11px] text-zinc-500">
              <span>Grouped per {seriesLabel.toLowerCase()}</span>
              <span>
                {timelineMode === "scanner"
                  ? `${timelineSeries.length} scanners in legend`
                  : `${timelineSeries.length} ticket types`}
              </span>
              <span>Scroll to zoom and drag to pan</span>
            </div>
            <ReactECharts
              ref={chartRef}
              option={chartOption}
              style={{ height: 440 }}
              opts={{ renderer: "canvas" }}
              onEvents={onEvents}
              notMerge
            />
          </>
        ) : (
          <div className="flex items-center justify-center h-[440px] text-zinc-600 text-sm">
            No check-ins yet
          </div>
        )}
      </div>

      {/* ── Standby line growth (if applicable) ── */}
      {data.standbyEnabled && standbyChartOption && (
        <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-5">
          <div className="flex items-center gap-3 mb-3">
            <h3 className="text-sm font-semibold text-white">
              Standby line growth
            </h3>
            <StatusPill color="amber">{byType.STANDBY.total} total</StatusPill>
            <StatusPill color="emerald">
              {byType.STANDBY.scanned} scanned
            </StatusPill>
          </div>
          <ReactECharts
            ref={standbyChartRef}
            option={standbyChartOption}
            style={{ height: 200 }}
            opts={{ renderer: "canvas" }}
            notMerge
          />
        </div>
      )}
    </div>
  );
}

// ── Wrapper ──────────────────────────────────────────────────────────────

export default function CheckInClient() {
  const { events, selectedEventId } = useEventContext();
  const currentEvent = events.find((e) => e.id === selectedEventId);

  return (
    <div className="px-4 sm:px-6 py-8">
      <div className="mb-8">
        <PageHeader
          title="Check-in"
          subtitle={
            currentEvent ? currentEvent.name || "Unnamed Event" : undefined
          }
        />
      </div>

      {!selectedEventId ? (
        <div className="text-center py-16 bg-zinc-900/60 rounded-2xl border border-white/10">
          <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircleIcon className="size-8 text-zinc-600" aria-hidden="true" />
          </div>
          <p className="text-zinc-400 text-lg mb-2">No event selected</p>
          <p className="text-zinc-600 text-sm">
            Select an event from the sidebar to view check-in data
          </p>
        </div>
      ) : (
        <CheckInContent eventId={selectedEventId} />
      )}
    </div>
  );
}
