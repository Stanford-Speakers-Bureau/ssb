"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { PACIFIC_TIMEZONE } from "../../lib/constants";
import TicketSalesGraph from "./TicketSalesGraph";

function formatDateTimeForInput(dateString: string | null): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PACIFIC_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const lookup: Record<string, string> = {};
  parts.forEach(({ type, value }) => {
    lookup[type] = value;
  });

  return `${lookup.year}-${lookup.month}-${lookup.day}T${lookup.hour}:${lookup.minute}`;
}

function formatDisplayDate(dateString: string | null): string {
  if (!dateString) return "TBD";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "TBD";

  return new Intl.DateTimeFormat("en-US", {
    timeZone: PACIFIC_TIMEZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export type Event = {
  id: string;
  created_at: string;
  name: string | null;
  desc: string | null;
  tagline: string | null;
  img: string | null;
  capacity: number;
  tickets?: number | null;
  venue: string | null;
  reserved: number | null;
  venue_link: string | null;
  release_date: string | null;
  banner: boolean | null;
  start_time_date: string | null;
  doors_open: string | null;
  route: string | null;
  image_url?: string | null;
  live?: boolean | null;
};

type FormData = {
  name: string;
  desc: string;
  tagline: string;
  capacity: string;
  tickets: string;
  reserved: string;
  venue: string;
  venue_link: string;
  release_date: string;
  start_time_date: string;
  doors_open: string;
  route: string;
  banner: boolean;
};

const emptyForm: FormData = {
  name: "",
  desc: "",
  tagline: "",
  capacity: "",
  tickets: "",
  reserved: "",
  venue: "",
  venue_link: "",
  release_date: "",
  start_time_date: "",
  doors_open: "",
  route: "",
  banner: false,
};

type AdminEventsClientProps = {
  initialEvents: Event[];
};

type EventCardImageProps = {
  event: Event;
};

function EventCardImage({ event }: EventCardImageProps) {
  const [isLoading, setIsLoading] = useState(true);

  if (!event.image_url) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <svg
          className="w-16 h-16 text-zinc-700"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>
    );
  }

  return (
    <>
      {isLoading && (
        <div className="absolute inset-0 bg-zinc-800 animate-pulse flex items-center justify-center">
          <svg
            className="w-10 h-10 text-zinc-700 animate-pulse"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
      )}
      <Image
        src={event.image_url}
        alt={event.name || "Event"}
        fill
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        className={`object-cover transition-opacity duration-300 ${
          isLoading ? "opacity-0" : "opacity-100"
        }`}
        onLoad={() => setIsLoading(false)}
        priority
      />
    </>
  );
}

export default function AdminEventsClient({
  initialEvents,
}: AdminEventsClientProps) {
  const [events, setEvents] = useState<Event[]>(initialEvents);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [viewingEvent, setViewingEvent] = useState<Event | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleEdit(event: Event) {
    setEditingEvent(event);
    setFormData({
      name: event.name || "",
      desc: event.desc || "",
      tagline: event.tagline || "",
      capacity: event.capacity?.toString() || "",
      tickets: event.tickets?.toString() || "",
      reserved: event.reserved?.toString() || "",
      venue: event.venue || "",
      venue_link: event.venue_link || "",
      release_date: formatDateTimeForInput(event.release_date),
      start_time_date: formatDateTimeForInput(event.start_time_date),
      doors_open: formatDateTimeForInput(event.doors_open),
      route: event.route || "",
      banner: event.banner || false,
    });
    setImagePreview(event.image_url || null);
    setImageFile(null);
    setShowForm(true);
  }

  function handleNew() {
    setEditingEvent(null);
    setFormData(emptyForm);
    setImagePreview(null);
    setImageFile(null);
    setShowForm(true);
  }

  function handleCancel() {
    setShowForm(false);
    setEditingEvent(null);
    setFormData(emptyForm);
    setImagePreview(null);
    setImageFile(null);
    setError(null);
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const submitData = new FormData();
      submitData.append("name", formData.name);
      submitData.append("desc", formData.desc);
      submitData.append("tagline", formData.tagline);
      submitData.append("capacity", formData.capacity);
      submitData.append("tickets", formData.tickets);
      submitData.append("reserved", formData.reserved);
      submitData.append("venue", formData.venue);
      submitData.append("venue_link", formData.venue_link);
      submitData.append("release_date", formData.release_date);
      submitData.append("start_time_date", formData.start_time_date);
      submitData.append("doors_open", formData.doors_open);
      submitData.append("route", formData.route);
      submitData.append("banner", formData.banner.toString());

      if (imageFile) {
        submitData.append("image", imageFile);
      }

      if (editingEvent) {
        submitData.append("id", editingEvent.id);
      }

      const response = await fetch("/api/admin/events", {
        method: "POST",
        body: submitData,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to save event");
        return;
      }

      const savedEvent = data.event as Event | undefined;

      if (savedEvent) {
        setEvents((prev) =>
          editingEvent
            ? prev.map((e) => (e.id === savedEvent.id ? savedEvent : e))
            : [savedEvent, ...prev],
        );
      }

      setSuccess(
        editingEvent
          ? "Event updated successfully!"
          : "Event created successfully!",
      );
      handleCancel();
    } catch (error) {
      console.error("Failed to save event:", error);
      setError("Failed to save event. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleToggleLive(event: Event) {
    const newLiveStatus = !event.live;

    if (
      newLiveStatus &&
      !confirm(
        `Set "${event.name || "this event"}" as live? This will make all other events not live.`,
      )
    ) {
      return;
    }

    try {
      const response = await fetch("/api/admin/events", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: event.id, live: newLiveStatus }),
      });

      const data = await response.json();

      if (response.ok && data.event) {
        const updatedEvent = data.event as Event;
        setEvents((prev) =>
          prev.map((e) =>
            e.id === updatedEvent.id ? updatedEvent : { ...e, live: false },
          ),
        );
        setSuccess(
          newLiveStatus
            ? "Event set to live successfully!"
            : "Event set to not live successfully!",
        );
      } else {
        setError(data.error || "Failed to update live status");
      }
    } catch (error) {
      console.error("Failed to toggle live status:", error);
      setError("Failed to update live status. Please try again.");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this event?")) return;

    try {
      const response = await fetch("/api/admin/events", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (response.ok) {
        setEvents((prev) => prev.filter((e) => e.id !== id));
        setSuccess("Event deleted successfully!");
      } else {
        const data = await response.json();
        setError(data.error || "Failed to delete event");
      }
    } catch (error) {
      console.error("Failed to delete event:", error);
      setError("Failed to delete event. Please try again.");
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white font-serif mb-2">
            Event Management
          </h1>
          <p className="text-zinc-400">Create and manage speaker events.</p>
        </div>
        {!showForm && (
          <button
            onClick={handleNew}
            className="flex items-center gap-2 px-5 py-2.5 bg-linear-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            Create Event
          </button>
        )}
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-3">
          <svg
            className="w-5 h-5 text-rose-400 shrink-0"
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
          <button
            onClick={() => setError(null)}
            className="ml-auto text-rose-400 hover:text-rose-300"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-3">
          <svg
            className="w-5 h-5 text-emerald-400 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
          <p className="text-emerald-400 text-sm">{success}</p>
          <button
            onClick={() => setSuccess(null)}
            className="ml-auto text-emerald-400 hover:text-emerald-300"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      )}

      {/* Event Form */}
      {showForm && (
        <div className="mb-8 bg-zinc-900 rounded-2xl border border-zinc-800 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">
              {editingEvent ? "Edit Event" : "Create New Event"}
            </h2>
            <button
              onClick={handleCancel}
              className="text-zinc-400 hover:text-white transition-colors"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Speaker Name */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Speaker Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="e.g., John Doe"
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50"
                />
              </div>

              {/* Route Slug */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  URL Route
                </label>
                <div className="flex items-center">
                  <span className="text-zinc-500 pr-2">/events/</span>
                  <input
                    type="text"
                    value={formData.route}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        route: e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9-]/g, "-"),
                      })
                    }
                    placeholder="john-doe"
                    className="flex-1 px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50"
                  />
                </div>
              </div>

              {/* Capacity */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Capacity
                </label>
                <input
                  type="number"
                  value={formData.capacity}
                  onChange={(e) =>
                    setFormData({ ...formData, capacity: e.target.value })
                  }
                  placeholder="e.g., 500"
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50"
                />
              </div>

              {/* Tickets Sold */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Tickets Sold
                </label>
                <input
                  type="number"
                  value={formData.tickets}
                  disabled={true}
                  placeholder="e.g., 250"
                  className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 cursor-not-allowed"
                />
              </div>

              {/* Reserved Seats (legacy / optional) */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Reserved Seats (optional)
                </label>
                <input
                  type="number"
                  value={formData.reserved}
                  onChange={(e) =>
                    setFormData({ ...formData, reserved: e.target.value })
                  }
                  placeholder="e.g., 50"
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50"
                />
              </div>

              {/* Venue */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Venue
                </label>
                <input
                  type="text"
                  value={formData.venue}
                  onChange={(e) =>
                    setFormData({ ...formData, venue: e.target.value })
                  }
                  placeholder="e.g., Memorial Auditorium"
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50"
                />
              </div>

              {/* Venue Link */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Venue Link (Google Maps)
                </label>
                <input
                  type="url"
                  value={formData.venue_link}
                  onChange={(e) =>
                    setFormData({ ...formData, venue_link: e.target.value })
                  }
                  placeholder="https://maps.google.com/..."
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50"
                />
              </div>

              {/* Release Date */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Release Date (when to reveal speaker)
                </label>
                <input
                  type="datetime-local"
                  value={formData.release_date}
                  onChange={(e) =>
                    setFormData({ ...formData, release_date: e.target.value })
                  }
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50"
                />
              </div>

              {/* Event Start Date/Time */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Event Start Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={formData.start_time_date}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      start_time_date: e.target.value,
                    })
                  }
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50"
                />
              </div>

              {/* Doors Open */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Doors Open
                </label>
                <input
                  type="datetime-local"
                  value={formData.doors_open}
                  onChange={(e) =>
                    setFormData({ ...formData, doors_open: e.target.value })
                  }
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50"
                />
              </div>

              {/* Show Banner */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="banner"
                  checked={formData.banner}
                  onChange={(e) =>
                    setFormData({ ...formData, banner: e.target.checked })
                  }
                  className="w-5 h-5 rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500/50"
                />
                <label
                  htmlFor="banner"
                  className="text-sm font-medium text-zinc-300"
                >
                  Show in Banner
                </label>
              </div>
            </div>

            {/* Tagline */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Tagline
              </label>
              <input
                type="text"
                value={formData.tagline}
                onChange={(e) =>
                  setFormData({ ...formData, tagline: e.target.value })
                }
                placeholder="Short tagline for the speaker..."
                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Description
              </label>
              <textarea
                value={formData.desc}
                onChange={(e) =>
                  setFormData({ ...formData, desc: e.target.value })
                }
                placeholder="Event description..."
                rows={4}
                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 resize-none"
              />
            </div>

            {/* Image Upload */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Speaker Image
              </label>
              <div className="flex items-start gap-6">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-32 h-32 bg-zinc-800 border-2 border-dashed border-zinc-600 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-emerald-500/50 transition-colors overflow-hidden"
                >
                  {imagePreview ? (
                    <Image
                      src={imagePreview}
                      alt="Preview"
                      width={128}
                      height={128}
                      className="w-full h-full object-cover"
                      priority
                    />
                  ) : (
                    <>
                      <svg
                        className="w-8 h-8 text-zinc-500 mb-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      <span className="text-zinc-500 text-xs">
                        Upload Image
                      </span>
                    </>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
                <div className="text-sm text-zinc-500">
                  <p>Recommended: 800x800px or larger</p>
                  <p>Supported formats: JPG, PNG, WebP</p>
                  {imageFile && (
                    <p className="text-emerald-400 mt-2">
                      Selected: {imageFile.name}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="flex items-center gap-4 pt-4 border-t border-zinc-800">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 px-6 py-3 bg-linear-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
                {editingEvent ? "Save Changes" : "Create Event"}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="px-6 py-3 text-zinc-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Events List */}
      {events.length === 0 ? (
        <div className="text-center py-16 bg-zinc-900/50 rounded-2xl border border-zinc-800">
          <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-zinc-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <p className="text-zinc-400 text-lg mb-2">No events yet</p>
          <p className="text-zinc-600 text-sm mb-6">
            Create your first speaker event to get started.
          </p>
          <button
            onClick={handleNew}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-linear-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            Create Event
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => (
              <div
                key={event.id}
                className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden hover:border-zinc-700 transition-colors group"
              >
                <div className="relative h-48 bg-zinc-800">
                  <EventCardImage event={event} />
                  {event.banner && (
                    <div className="absolute top-3 left-3 px-2 py-1 bg-emerald-500 text-white text-xs font-medium rounded-full z-10">
                      Banner
                    </div>
                  )}
                  {event.live && (
                    <div className="absolute top-3 right-3 px-2 py-1 bg-red-500 text-white text-xs font-medium rounded-full z-10 flex items-center gap-1">
                      <svg
                        className="w-3 h-3"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                          clipRule="evenodd"
                        />
                      </svg>
                      LIVE
                    </div>
                  )}
                </div>
                <div className="p-5">
                  <h3 className="text-lg font-semibold text-white mb-1 truncate">
                    {event.name || "Mystery Speaker"}
                  </h3>
                  <div className="flex items-center gap-3 text-sm text-zinc-500 mb-4">
                    <span className="flex items-center gap-1">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      {formatDisplayDate(event.start_time_date)}
                    </span>
                    <span className="flex items-center gap-1">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                        />
                      </svg>
                      {event.capacity}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => setViewingEvent(event)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30 rounded text-sm font-medium transition-colors"
                    >
                      <svg
                        className="w-4 h-4"
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
                      View Sales
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleLive(event);
                      }}
                      className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded text-sm font-medium transition-colors ${
                        event.live
                          ? "bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30"
                          : "bg-zinc-800 text-white hover:bg-zinc-700"
                      }`}
                    >
                      {event.live ? (
                        <>
                          <svg
                            className="w-4 h-4"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 012 0v4a1 1 0 11-2 0V7zM12 9a1 1 0 10-2 0v2a1 1 0 102 0V9z"
                              clipRule="evenodd"
                            />
                          </svg>
                          Set Not Live
                        </>
                      ) : (
                        <>
                          <svg
                            className="w-4 h-4"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                              clipRule="evenodd"
                            />
                          </svg>
                          Set Live
                        </>
                      )}
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(event);
                        }}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-zinc-800 text-white rounded text-sm font-medium hover:bg-zinc-700 transition-colors"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                        Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(event.id);
                        }}
                        className="px-4 py-2 text-rose-400 hover:bg-rose-500/10 rounded text-sm font-medium transition-colors"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Event Detail Modal */}
      {viewingEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setViewingEvent(null)}
        >
          <div
            className="bg-zinc-900 rounded-2xl border border-zinc-800 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 p-6 flex items-center justify-between z-10">
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">
                  {viewingEvent.name || "Mystery Speaker"}
                </h2>
                <p className="text-sm text-zinc-400">
                  {formatDisplayDate(viewingEvent.start_time_date)}
                </p>
              </div>
              <button
                onClick={() => setViewingEvent(null)}
                className="text-zinc-400 hover:text-white transition-colors p-2 hover:bg-zinc-800 rounded-lg"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Event Details */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-zinc-400">Capacity:</span>
                  <span className="text-white ml-2 font-medium">
                    {viewingEvent.capacity}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-400">Tickets Sold:</span>
                  <span className="text-white ml-2 font-medium">
                    {viewingEvent.tickets ?? viewingEvent.reserved ?? 0}
                  </span>
                </div>
                {viewingEvent.venue && (
                  <div className="col-span-2">
                    <span className="text-zinc-400">Venue:</span>
                    <span className="text-white ml-2 font-medium">
                      {viewingEvent.venue}
                    </span>
                  </div>
                )}
              </div>

              {/* Ticket Sales Graph */}
              <TicketSalesGraph eventId={viewingEvent.id} />

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-4 border-t border-zinc-800">
                <button
                  onClick={() => {
                    setViewingEvent(null);
                    handleEdit(viewingEvent);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-zinc-800 text-white rounded-lg text-sm font-medium hover:bg-zinc-700 transition-colors"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                  Edit Event
                </button>
                <button
                  onClick={() => {
                    if (
                      confirm("Are you sure you want to delete this event?")
                    ) {
                      handleDelete(viewingEvent.id);
                      setViewingEvent(null);
                    }
                  }}
                  className="px-4 py-2 text-rose-400 hover:bg-rose-500/10 rounded-lg text-sm font-medium transition-colors"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
