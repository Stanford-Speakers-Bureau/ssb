"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

type SalesDataPoint = {
  time: string;
  count: number;
  cumulative: number;
};

type TicketSalesGraphProps = {
  eventId: string;
};

export default function TicketSalesGraph({ eventId }: TicketSalesGraphProps) {
  const [data, setData] = useState<SalesDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalTickets, setTotalTickets] = useState(0);

  useEffect(() => {
    async function fetchSalesData() {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(`/api/admin/events/${eventId}/sales`);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to fetch sales data");
        }

        const result = await response.json();
        setData(result.data || []);
        setTotalTickets(result.totalTickets || 0);
      } catch (err) {
        console.error("Error fetching sales data:", err);
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setIsLoading(false);
      }
    }

    if (eventId) {
      fetchSalesData();
    }
  }, [eventId]);

  // Format data for chart
  const chartData = data.map((point) => {
    const date = new Date(point.time);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const month = date.toLocaleDateString("en-US", { month: "short" });
    const day = date.getDate();

    // Format label based on data density
    let label: string;
    if (data.length <= 24) {
      // Show time for hourly data
      label = `${month} ${day}, ${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
    } else if (data.length <= 28) {
      // Show date for daily data
      label = `${month} ${day}`;
    } else {
      // Show week for weekly data
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      label = `Week of ${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
    }

    return {
      time: label,
      timestamp: point.time,
      "Tickets Sold This Period": point.count,
      "Total Tickets": point.cumulative,
    };
  });

  if (isLoading) {
    return (
      <div className="w-full h-64 flex items-center justify-center bg-zinc-900/50 rounded-xl border border-zinc-800">
        <div className="flex items-center gap-3 text-zinc-400">
          <div className="w-5 h-5 border-2 border-zinc-600 border-t-zinc-400 rounded-full animate-spin" />
          <span className="text-sm">Loading sales data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-64 flex items-center justify-center bg-zinc-900/50 rounded-xl border border-zinc-800">
        <div className="text-center">
          <svg
            className="w-12 h-12 text-rose-400 mx-auto mb-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-rose-400 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="w-full h-64 flex items-center justify-center bg-zinc-900/50 rounded-xl border border-zinc-800">
        <div className="text-center">
          <svg
            className="w-12 h-12 text-zinc-600 mx-auto mb-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          <p className="text-zinc-400 text-sm">
            No ticket sales data available
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-zinc-900/50 rounded-xl border border-zinc-800 p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white mb-1">
          Ticket Sales Over Time
        </h3>
        <p className="text-sm text-zinc-400">
          Total tickets sold:{" "}
          <span className="text-white font-medium">{totalTickets}</span>
        </p>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
          <XAxis
            dataKey="time"
            stroke="#a1a1aa"
            style={{ fontSize: "12px" }}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis
            stroke="#a1a1aa"
            style={{ fontSize: "12px" }}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#18181b",
              border: "1px solid #3f3f46",
              borderRadius: "8px",
              color: "#fafafa",
            }}
            labelStyle={{ color: "#a1a1aa", marginBottom: "4px" }}
          />
          <Legend wrapperStyle={{ paddingTop: "20px" }} iconType="line" />
          <Line
            type="monotone"
            dataKey="Tickets Sold This Period"
            stroke="#10b981"
            strokeWidth={2}
            dot={{ fill: "#10b981", r: 3 }}
            activeDot={{ r: 5 }}
            name="Tickets Sold This Period"
          />
          <Line
            type="monotone"
            dataKey="Total Tickets"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ fill: "#3b82f6", r: 3 }}
            activeDot={{ r: 5 }}
            name="Total Tickets"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
