"use client";

import { useEffect, useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import { useEventContext } from "@/app/EventContext";
import { runChunkedSend, type BulkSendProgressState } from "@/app/lib/bulkSend";
import {
  PageHeader,
  Button,
  Card,
  EmptyState,
  Alert,
  SegmentedControl,
} from "@/app/components/ui";

type FeedbackRow = {
  ticketId: string;
  name: string | null;
  email: string;
  score: number;
  comment: string | null;
  submittedAt: string;
  updatedAt: string;
  submittedVia: string;
};

type EligibleTicketRow = {
  ticketId: string;
  name: string | null;
  email: string;
  scanTime: string | null;
};

type AnalyticsResponse = {
  eventId: string;
  eventName: string | null;
  eventStartTime: string | null;
  eventEndTime: string | null;
  totalScanned: number;
  totalResponses: number;
  responseRate: number;
  averageScore: number;
  npsScore: number;
  promoters: number;
  passives: number;
  detractors: number;
  scoreDistribution: number[];
  feedback: FeedbackRow[];
  eligibleMissing: EligibleTicketRow[];
};

const SEND_CHUNK_SIZE = 25;

function formatTimestamp(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
  });
}

function scoreTone(score: number): string {
  if (score >= 9) return "text-emerald-400";
  if (score >= 7) return "text-amber-400";
  return "text-rose-400";
}

function scoreBg(score: number): string {
  if (score >= 9) return "bg-emerald-500/15 border-emerald-500/30";
  if (score >= 7) return "bg-amber-500/15 border-amber-500/30";
  return "bg-rose-500/15 border-rose-500/30";
}

function formatEventDateRange(
  start: string | null,
  end: string | null,
): string {
  if (!start) return "";
  const startDate = new Date(start);
  const dateStr = startDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Los_Angeles",
  });
  const startTime = startDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
  });
  if (!end) return `${dateStr} · ${startTime}`;
  const endTime = new Date(end).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
  });
  return `${dateStr} · ${startTime} – ${endTime}`;
}

async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export default function FeedbackAnalyticsClient() {
  const { events, selectedEventId } = useEventContext();
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scoreFilter, setScoreFilter] = useState<
    "all" | "promoters" | "passives" | "detractors"
  >("all");
  const [commentOnly, setCommentOnly] = useState(false);
  const [anonymous, setAnonymous] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedTicketIds, setSelectedTicketIds] = useState<Set<string>>(
    new Set(),
  );
  const [sendProgress, setSendProgress] =
    useState<BulkSendProgressState | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<string | null>(null);

  const currentEvent = events.find((e) => e.id === selectedEventId);

  useEffect(() => {
    if (!selectedEventId) {
      setData(null);
      return;
    }
    const controller = new AbortController();
    async function fetchData() {
      setIsLoading(true);
      setError(null);
      setSelectedTicketIds(new Set());
      setSendResult(null);
      setSendError(null);
      try {
        const res = await fetch(
          `/api/feedback/analytics?eventId=${selectedEventId}`,
          { signal: controller.signal, cache: "no-store" },
        );
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to fetch analytics");
        }
        setData(await res.json());
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
    return () => controller.abort();
  }, [selectedEventId]);

  const filteredFeedback = useMemo(() => {
    if (!data) return [];
    const query = search.trim().toLowerCase();
    return data.feedback.filter((row) => {
      if (scoreFilter === "promoters" && row.score < 9) return false;
      if (scoreFilter === "passives" && (row.score < 7 || row.score >= 9))
        return false;
      if (scoreFilter === "detractors" && row.score >= 7) return false;
      if (commentOnly && !row.comment) return false;
      if (query) {
        const haystack = anonymous
          ? (row.comment ?? "").toLowerCase()
          : `${row.name ?? ""} ${row.email} ${row.comment ?? ""}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [data, scoreFilter, commentOnly, search, anonymous]);

  const filteredEligible = useMemo(() => {
    if (!data) return [];
    const query = search.trim().toLowerCase();
    if (!query || anonymous) return data.eligibleMissing;
    return data.eligibleMissing.filter((row) => {
      const haystack = `${row.name ?? ""} ${row.email}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [data, search, anonymous]);

  const distributionScale = data?.totalResponses ?? 0;

  const scoreDistributionOption = useMemo(() => {
    const counts = data?.scoreDistribution ?? [];
    const total = distributionScale;
    const barColor = (score: number) => {
      if (score >= 9) return "#10b981";
      if (score >= 7) return "#f59e0b";
      return "#f43f5e";
    };
    return {
      grid: { left: 36, right: 16, top: 24, bottom: 28 },
      tooltip: {
        trigger: "axis" as const,
        axisPointer: { type: "shadow" as const },
        backgroundColor: "#18181b",
        borderColor: "#3f3f46",
        textStyle: { color: "#e4e4e7", fontSize: 12 },
        formatter: (params: unknown) => {
          const arr = params as Array<{ name: string; value: number }>;
          const p = arr[0];
          const pct = total > 0 ? ((p.value / total) * 100).toFixed(0) : "0";
          return `Score ${p.name}<br/>${p.value} response${p.value === 1 ? "" : "s"} (${pct}%)`;
        },
      },
      xAxis: {
        type: "category" as const,
        data: counts.map((_, i) => String(i + 1)),
        axisLine: { lineStyle: { color: "#3f3f46" } },
        axisTick: { show: false },
        axisLabel: { color: "#a1a1aa", fontSize: 11 },
      },
      yAxis: {
        type: "value" as const,
        minInterval: 1,
        splitLine: { lineStyle: { color: "#27272a" } },
        axisLabel: { color: "#71717a", fontSize: 11 },
      },
      series: [
        {
          type: "bar" as const,
          data: counts.map((count, idx) => ({
            value: count,
            itemStyle: {
              color: barColor(idx + 1),
              borderRadius: [4, 4, 0, 0],
            },
          })),
          barMaxWidth: 40,
          label: {
            show: true,
            position: "top" as const,
            color: "#d4d4d8",
            fontSize: 11,
            fontWeight: 600,
            formatter: (p: { value: number }) =>
              p.value > 0 ? String(p.value) : "",
          },
        },
      ],
    };
  }, [data?.scoreDistribution, distributionScale]);

  function toggleSelect(ticketId: string) {
    setSelectedTicketIds((prev) => {
      const next = new Set(prev);
      if (next.has(ticketId)) {
        next.delete(ticketId);
      } else {
        next.add(ticketId);
      }
      return next;
    });
  }

  function toggleSelectAllVisible() {
    const visibleIds = filteredEligible.map((row) => row.ticketId);
    const allSelected = visibleIds.every((id) => selectedTicketIds.has(id));
    setSelectedTicketIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        for (const id of visibleIds) next.delete(id);
      } else {
        for (const id of visibleIds) next.add(id);
      }
      return next;
    });
  }

  async function handleDownloadPdf() {
    if (!data) return;
    const [{ default: jsPDF }, logoDataUrl] = await Promise.all([
      import("jspdf"),
      fetchImageAsDataUrl("/logo.png"),
    ]);
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 48;
    const contentW = pageW - margin * 2;
    let y = margin;

    const BRAND_R = 168;
    const BRAND_G = 13;
    const BRAND_B = 12;

    const ensureSpace = (needed: number) => {
      if (y + needed > pageH - margin - 32) {
        doc.addPage();
        y = margin;
      }
    };

    const logoSize = 44;
    if (logoDataUrl) {
      doc.addImage(logoDataUrl, "PNG", margin, y, logoSize, logoSize);
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(20, 20, 20);
    doc.text("Stanford Speakers Bureau", margin + logoSize + 14, y + 18);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.text("Feedback Report", margin + logoSize + 14, y + 34);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(140, 140, 140);
    doc.text(
      `Generated ${new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })}`,
      pageW - margin,
      y + 18,
      { align: "right" },
    );
    doc.text("Anonymized", pageW - margin, y + 32, { align: "right" });

    y += logoSize + 16;
    doc.setDrawColor(BRAND_R, BRAND_G, BRAND_B);
    doc.setLineWidth(1.5);
    doc.line(margin, y, margin + contentW, y);
    doc.setLineWidth(1);
    y += 22;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(BRAND_R, BRAND_G, BRAND_B);
    doc.text("EVENT", margin, y);
    y += 26;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(20, 20, 20);
    const nameLines = doc.splitTextToSize(
      data.eventName || "Unnamed Event",
      contentW,
    ) as string[];
    nameLines.forEach((line) => {
      doc.text(line, margin, y);
      y += 26;
    });
    y += 4;

    const dateLine = formatEventDateRange(
      data.eventStartTime,
      data.eventEndTime,
    );
    if (dateLine) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(90, 90, 90);
      doc.text(dateLine, margin, y);
      y += 16;
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `${data.totalResponses} response${data.totalResponses === 1 ? "" : "s"}`,
      margin,
      y,
    );
    y += 24;

    const npsColor: [number, number, number] =
      data.totalResponses === 0
        ? [20, 20, 20]
        : data.npsScore >= 50
          ? [16, 185, 129]
          : data.npsScore >= 0
            ? [245, 158, 11]
            : [244, 63, 94];
    const stats: Array<{
      label: string;
      value: string;
      valueColor: [number, number, number];
    }> = [
      {
        label: "RESPONSES",
        value: String(data.totalResponses),
        valueColor: [20, 20, 20],
      },
      {
        label: "AVERAGE SCORE",
        value: data.totalResponses > 0 ? data.averageScore.toFixed(2) : "—",
        valueColor: [20, 20, 20],
      },
      {
        label: "NPS",
        value: data.totalResponses > 0 ? data.npsScore.toFixed(0) : "—",
        valueColor: npsColor,
      },
    ];
    const boxGap = 16;
    const boxW = (contentW - boxGap * 2) / 3;
    const boxH = 72;
    stats.forEach((s, i) => {
      const x = margin + i * (boxW + boxGap);
      doc.setDrawColor(220, 220, 220);
      doc.setFillColor(248, 248, 249);
      doc.roundedRect(x, y, boxW, boxH, 6, 6, "FD");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(110, 110, 110);
      doc.text(s.label, x + 14, y + 20);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(s.valueColor[0], s.valueColor[1], s.valueColor[2]);
      doc.text(s.value, x + 14, y + 50);
    });
    y += boxH + 10;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(90, 90, 90);
    doc.text(
      `${data.promoters} promoters · ${data.passives} passives · ${data.detractors} detractors`,
      margin,
      y,
    );
    y += 24;

    ensureSpace(210);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(20, 20, 20);
    doc.text("Score Distribution", margin, y);
    y += 18;

    const chartTop = y;
    const chartH = 150;
    const maxCount = Math.max(1, ...data.scoreDistribution);
    const barGap = 10;
    const barW = (contentW - barGap * 9) / 10;

    doc.setDrawColor(230, 230, 230);
    doc.line(margin, chartTop + chartH, margin + contentW, chartTop + chartH);

    data.scoreDistribution.forEach((count, idx) => {
      const score = idx + 1;
      const barH =
        count > 0 ? Math.max(2, (count / maxCount) * (chartH - 24)) : 0;
      const bx = margin + idx * (barW + barGap);
      const by = chartTop + chartH - barH;
      if (score >= 9) doc.setFillColor(16, 185, 129);
      else if (score >= 7) doc.setFillColor(245, 158, 11);
      else doc.setFillColor(244, 63, 94);
      if (barH > 0) doc.rect(bx, by, barW, barH, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      doc.text(String(count), bx + barW / 2, by - 4, { align: "center" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(120, 120, 120);
      doc.text(String(score), bx + barW / 2, chartTop + chartH + 14, {
        align: "center",
      });
    });
    y = chartTop + chartH + 32;

    const sections: Array<{
      title: string;
      rows: FeedbackRow[];
      color: [number, number, number];
    }> = [
      {
        title: "Promoters (9–10)",
        rows: data.feedback.filter((r) => r.score >= 9),
        color: [16, 185, 129],
      },
      {
        title: "Passives (7–8)",
        rows: data.feedback.filter((r) => r.score === 7 || r.score === 8),
        color: [245, 158, 11],
      },
      {
        title: "Detractors (1–6)",
        rows: data.feedback.filter((r) => r.score <= 6),
        color: [244, 63, 94],
      },
    ];

    for (const section of sections) {
      ensureSpace(60);
      doc.setDrawColor(230, 230, 230);
      doc.line(margin, y, margin + contentW, y);
      y += 18;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(20, 20, 20);
      doc.text(section.title, margin, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(120, 120, 120);
      doc.text(
        `${section.rows.length} response${section.rows.length === 1 ? "" : "s"}`,
        margin + contentW,
        y,
        { align: "right" },
      );
      y += 18;

      if (section.rows.length === 0) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(10);
        doc.setTextColor(160, 160, 160);
        doc.text("No responses.", margin, y);
        y += 24;
        continue;
      }

      const sorted = [...section.rows].sort((a, b) => b.score - a.score);
      for (const row of sorted) {
        const hasComment = Boolean(row.comment?.trim());
        const commentText = hasComment
          ? row.comment!.trim()
          : "No comment provided.";
        const lines = doc.splitTextToSize(
          commentText,
          contentW - 54,
        ) as string[];
        const blockH = Math.max(34, lines.length * 13 + 14);
        ensureSpace(blockH + 8);

        const [r, g, b] = section.color;
        doc.setFillColor(r, g, b);
        doc.roundedRect(margin, y, 38, 30, 4, 4, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(255, 255, 255);
        doc.text(String(row.score), margin + 19, y + 20, { align: "center" });

        doc.setFont("helvetica", hasComment ? "normal" : "italic");
        doc.setFontSize(10);
        if (hasComment) doc.setTextColor(40, 40, 40);
        else doc.setTextColor(160, 160, 160);
        doc.text(lines, margin + 50, y + 14);

        y += blockH + 6;
      }
      y += 10;
    }

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setDrawColor(230, 230, 230);
      doc.setLineWidth(0.5);
      doc.line(margin, pageH - 32, pageW - margin, pageH - 32);
      if (logoDataUrl) {
        doc.addImage(logoDataUrl, "PNG", margin, pageH - 26, 12, 12);
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(140, 140, 140);
      doc.text(
        "Stanford Speakers Bureau · Anonymized feedback report",
        margin + (logoDataUrl ? 18 : 0),
        pageH - 17,
      );
      doc.text(`Page ${i} of ${pageCount}`, pageW - margin, pageH - 17, {
        align: "right",
      });
    }

    const safeName = (data.eventName || "event")
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();
    doc.save(`feedback-report-${safeName || "event"}.pdf`);
  }

  async function handleSendFeedbackPrompts() {
    if (!selectedEventId) return;
    const ids = [...selectedTicketIds];
    if (ids.length === 0) return;
    setSendError(null);
    setSendResult(null);

    try {
      const finalState = await runChunkedSend({
        items: ids,
        chunkSize: SEND_CHUNK_SIZE,
        label: "Sending feedback prompts",
        onProgress: setSendProgress,
        sendChunk: async (chunk) => {
          const res = await fetch(`/api/feedback/analytics/send`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              eventId: selectedEventId,
              ticketIds: chunk,
            }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || "Failed to send prompts");
          }
          const body = (await res.json()) as {
            sent: number;
            failed: number;
            skipped: number;
          };
          return {
            sent: body.sent,
            failed: body.failed,
            skipped: body.skipped,
          };
        },
      });
      setSendResult(
        `Sent ${finalState.sent}/${finalState.total}${
          finalState.failed > 0 ? `, ${finalState.failed} failed` : ""
        }${finalState.skipped > 0 ? `, ${finalState.skipped} skipped` : ""}.`,
      );
      setSelectedTicketIds(new Set());
      if (selectedEventId) {
        fetch(`/api/feedback/analytics?eventId=${selectedEventId}`, {
          cache: "no-store",
        })
          .then((r) => r.json())
          .then((fresh) => setData(fresh))
          .catch(() => {});
      }
    } catch (err) {
      setSendError(
        err instanceof Error ? err.message : "Failed to send feedback prompts",
      );
    } finally {
      setSendProgress((prev) =>
        prev ? { ...prev, active: false, done: true } : prev,
      );
    }
  }

  if (!selectedEventId) {
    return (
      <div className="px-4 sm:px-6 py-8 space-y-6">
        <PageHeader title="Feedback analytics" />
        <EmptyState title="Select an event to view feedback." />
      </div>
    );
  }

  if (isLoading && !data) {
    return (
      <div className="px-4 sm:px-6 py-8 space-y-6">
        <PageHeader
          title="Feedback analytics"
          subtitle={
            currentEvent ? currentEvent.name || "Unnamed Event" : undefined
          }
        />
        <div className="flex items-center justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-200" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 sm:px-6 py-8 space-y-6">
        <PageHeader title="Feedback analytics" />
        <Alert tone="error">{error}</Alert>
      </div>
    );
  }

  if (!data) return null;

  const progressSentPct =
    sendProgress && sendProgress.total > 0
      ? ((sendProgress.sent + sendProgress.failed + sendProgress.skipped) /
          sendProgress.total) *
        100
      : 0;

  return (
    <div className="px-4 sm:px-6 py-8">
      <PageHeader
        title="Feedback analytics"
        subtitle={
          currentEvent ? currentEvent.name || "Unnamed Event" : undefined
        }
        className="mb-8"
      >
        <Button
          variant="primary"
          onClick={handleDownloadPdf}
          disabled={!data || data.totalResponses === 0}
        >
          Download PDF report
        </Button>
      </PageHeader>

      <div className="space-y-5">
        {/* Stat Cards */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Card className="px-4 py-3">
            <p className="text-xs font-medium tracking-wide text-zinc-400">
              Responses
            </p>
            <p className="mt-2 text-2xl font-bold text-blue-400 tabular-nums">
              {data.totalResponses}
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              {data.totalResponses === 1 ? "response" : "responses"} collected
            </p>
          </Card>
          <Card className="px-4 py-3">
            <p className="text-xs font-medium tracking-wide text-zinc-400">
              Average score
            </p>
            <p className="mt-2 text-2xl font-bold text-violet-400 tabular-nums">
              {data.totalResponses > 0 ? data.averageScore.toFixed(2) : "—"}
              <span className="text-base text-zinc-500 font-semibold">
                {" "}
                / 10
              </span>
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              {data.totalResponses > 0
                ? `Across ${data.totalResponses} responses`
                : "No responses yet"}
            </p>
          </Card>
          <Card className="px-4 py-3">
            <p className="text-xs font-medium tracking-wide text-zinc-400">
              NPS
            </p>
            <p
              className={`mt-2 text-2xl font-bold tabular-nums ${
                data.npsScore >= 50
                  ? "text-emerald-400"
                  : data.npsScore >= 0
                    ? "text-amber-400"
                    : "text-rose-400"
              }`}
            >
              {data.totalResponses > 0 ? data.npsScore.toFixed(0) : "—"}
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              {data.promoters} promoters · {data.passives} passives ·{" "}
              {data.detractors} detractors
            </p>
          </Card>
        </div>

        {/* Score Distribution */}
        <Card className="p-5">
          <div className="flex items-baseline justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">
              Score distribution
            </h3>
            <p className="text-[11px] text-zinc-500">
              % of {distributionScale} response
              {distributionScale === 1 ? "" : "s"} · 1 = not likely · 10 =
              extremely likely
            </p>
          </div>
          <div className="h-56">
            <ReactECharts
              option={scoreDistributionOption}
              style={{ height: "100%", width: "100%" }}
              opts={{ renderer: "canvas" }}
              notMerge
            />
          </div>
        </Card>

        {/* Controls */}
        <Card className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl
              aria-label="Filter by score"
              value={scoreFilter}
              onChange={setScoreFilter}
              options={[
                { value: "all", label: "All" },
                { value: "promoters", label: "Promoters" },
                { value: "passives", label: "Passives" },
                { value: "detractors", label: "Detractors" },
              ]}
            />
            <label className="flex items-center gap-2 text-xs text-zinc-300 ml-2">
              <input
                type="checkbox"
                checked={commentOnly}
                onChange={(e) => setCommentOnly(e.target.checked)}
                className="size-5 sm:size-4 rounded accent-rose-500"
              />
              Has comment
            </label>
            <label className="flex items-center gap-2 text-xs text-zinc-300 ml-2">
              <input
                type="checkbox"
                checked={anonymous}
                onChange={(e) => setAnonymous(e.target.checked)}
                className="size-5 sm:size-4 rounded accent-rose-500"
              />
              Anonymous
            </label>
          </div>
          <input
            type="search"
            aria-label="Search feedback"
            placeholder={
              anonymous ? "Search comments…" : "Search by name, email, comment…"
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg bg-white/5 px-3 py-2 text-sm text-white ring-1 ring-inset ring-white/10 placeholder:text-zinc-500 focus:outline-2 focus:-outline-offset-1 focus:outline-rose-500 max-sm:text-base sm:w-72"
          />
        </Card>

        {/* Feedback Table */}
        <Card className="overflow-hidden p-0">
          <div className="px-4 py-3 border-b border-white/10 flex items-baseline justify-between">
            <h3 className="text-sm font-semibold text-white">Responses</h3>
            <span className="text-xs text-zinc-500 tabular-nums">
              {filteredFeedback.length} of {data.feedback.length}
            </span>
          </div>
          {filteredFeedback.length === 0 ? (
            <div className="py-10 text-center text-sm text-zinc-500">
              No feedback matches these filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-900/70 text-left text-xs tracking-wide text-zinc-400">
                  <tr>
                    <th className="px-4 py-2 w-16 whitespace-nowrap font-medium">
                      Score
                    </th>
                    {!anonymous && (
                      <th className="px-4 py-2 whitespace-nowrap font-medium">
                        Attendee
                      </th>
                    )}
                    <th className="px-4 py-2 whitespace-nowrap font-medium">
                      Comment
                    </th>
                    <th className="px-4 py-2 w-36 whitespace-nowrap font-medium">
                      Submitted
                    </th>
                    <th className="px-4 py-2 w-24 whitespace-nowrap font-medium">
                      Via
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {filteredFeedback.map((row) => (
                    <tr key={row.ticketId} className="hover:bg-zinc-900/40">
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center justify-center h-8 w-10 rounded-lg border text-sm font-bold tabular-nums ${scoreBg(row.score)} ${scoreTone(row.score)}`}
                        >
                          {row.score}
                        </span>
                      </td>
                      {!anonymous && (
                        <td className="px-4 py-3">
                          <div className="text-white">{row.name || "—"}</div>
                          <div className="text-xs text-zinc-500">
                            {row.email}
                          </div>
                        </td>
                      )}
                      <td className="px-4 py-3 text-zinc-300 max-w-md">
                        {row.comment ? (
                          <p className="whitespace-pre-wrap break-words">
                            {row.comment}
                          </p>
                        ) : (
                          <span className="text-zinc-600 italic">
                            No comment
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-400">
                        {formatTimestamp(row.updatedAt)}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-400">
                        {row.submittedVia === "signed_link" ? "Email" : "Site"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Non-responders + Bulk Send */}
        <Card className="overflow-hidden p-0">
          <div className="px-4 py-3 border-b border-white/10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">
                Haven&apos;t submitted
              </h3>
              <p className="text-xs text-zinc-500">
                Scanned attendees without feedback · {filteredEligible.length}{" "}
                shown
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={toggleSelectAllVisible}
                disabled={filteredEligible.length === 0}
              >
                {filteredEligible.every((row) =>
                  selectedTicketIds.has(row.ticketId),
                ) && filteredEligible.length > 0
                  ? "Deselect visible"
                  : "Select visible"}
              </Button>
              <Button
                variant="primary"
                onClick={handleSendFeedbackPrompts}
                disabled={
                  selectedTicketIds.size === 0 ||
                  Boolean(sendProgress && sendProgress.active)
                }
              >
                {sendProgress && sendProgress.active
                  ? `Sending… ${sendProgress.sent}/${sendProgress.total}`
                  : `Send feedback prompt (${selectedTicketIds.size})`}
              </Button>
            </div>
          </div>

          {sendProgress && (
            <div className="px-4 py-3 border-b border-white/10 bg-zinc-900/40">
              <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full bg-rose-500 transition-[width]"
                  style={{ width: `${progressSentPct}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-zinc-500">
                {sendProgress.label} · {sendProgress.sent} sent,{" "}
                {sendProgress.failed} failed, {sendProgress.skipped} skipped
              </p>
            </div>
          )}

          {sendError && (
            <div className="px-4 py-3 border-b border-white/10 bg-rose-500/10 text-rose-300 text-xs">
              {sendError}
            </div>
          )}

          {sendResult && !sendError && (
            <div className="px-4 py-3 border-b border-white/10 bg-emerald-500/10 text-emerald-300 text-xs">
              {sendResult}
            </div>
          )}

          {filteredEligible.length === 0 ? (
            <div className="py-10 text-center text-sm text-zinc-500">
              {data.totalScanned === 0
                ? "No scanned attendees yet."
                : "Every scanned attendee has submitted feedback. Nice."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-900/70 text-left text-xs tracking-wide text-zinc-400">
                  <tr>
                    <th className="px-4 py-2 w-10"></th>
                    <th className="px-4 py-2 whitespace-nowrap font-medium">
                      Attendee
                    </th>
                    <th className="px-4 py-2 w-40 whitespace-nowrap font-medium">
                      Checked in
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {filteredEligible.map((row) => {
                    const checked = selectedTicketIds.has(row.ticketId);
                    return (
                      <tr
                        key={row.ticketId}
                        className={`hover:bg-zinc-900/40 ${checked ? "bg-zinc-900/60" : ""}`}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSelect(row.ticketId)}
                            className="size-5 sm:size-4 rounded accent-rose-500"
                          />
                        </td>
                        <td className="px-4 py-3">
                          {anonymous ? (
                            <div className="text-zinc-500 italic">Hidden</div>
                          ) : (
                            <>
                              <div className="text-white">
                                {row.name || "—"}
                              </div>
                              <div className="text-xs text-zinc-500">
                                {row.email}
                              </div>
                            </>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-zinc-400">
                          {formatTimestamp(row.scanTime)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
