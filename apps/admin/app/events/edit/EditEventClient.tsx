"use client";

import { useRef, useState, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { PACIFIC_TIMEZONE } from "@/app/lib/constants";
import { useEventContext } from "@/app/EventContext";
import { sortByStartDate } from "@/app/lib/formatting";
import {
  DEFAULT_TICKETING_ROLES,
  TICKETING_ROLE_OPTIONS,
  type TicketingRole,
} from "@/app/lib/ticketingRoles";
import MarkdownEditor from "@/app/components/MarkdownEditor";
import {
  PlusIcon,
  XMarkIcon,
  CheckIcon,
  PhotoIcon,
} from "@heroicons/react/16/solid";
import {
  Button,
  Card,
  Well,
  EmptyState,
  Input,
  Label,
  Checkbox,
  Tabs,
  Tab,
  Alert,
  PageHeader,
} from "@/app/components/ui";
import { Event } from "../AdminEventsClient";

const APPLE_WALLET_STRIP_RATIO = 375 / 98;
const APPLE_WALLET_STRIP_RATIO_TOLERANCE = 0.02;
const APPLE_WALLET_MIN_WIDTH = 1125;
const APPLE_WALLET_MIN_HEIGHT = 294;

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
  ticketing_date: string;
  start_time_date: string;
  end_time_date: string;
  doors_open: string;
  route: string;
  priority: string;
  ticketing_roles: TicketingRole[];
  hide_ticketing_date: boolean;
  referrals_enabled: boolean;
  standby_enabled: boolean;
  livestream: string;
  latitude: string;
  longitude: string;
  address: string;
  external_ticketing_enabled: boolean;
  external_ticketing_url: string;
  banner_eligible: boolean;
  identity_verification_enabled: boolean;
  allow_admitting_standby: boolean;
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
  ticketing_date: "",
  start_time_date: "",
  end_time_date: "",
  doors_open: "",
  route: "",
  priority: "This event is only open to Stanford affiliates",
  ticketing_roles: [...DEFAULT_TICKETING_ROLES],
  hide_ticketing_date: false,
  referrals_enabled: false,
  standby_enabled: false,
  livestream: "",
  latitude: "",
  longitude: "",
  address: "",
  external_ticketing_enabled: false,
  external_ticketing_url: "",
  banner_eligible: true,
  identity_verification_enabled: true,
  allow_admitting_standby: false,
};

const sortEvents = sortByStartDate<Event>;

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="border-b border-white/10 pb-3">
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <p className="mt-1 text-sm text-zinc-500">{description}</p>
    </div>
  );
}

function toEventOption(event: Event) {
  return {
    id: event.id,
    name: event.name,
    start_time_date: event.start_time_date,
    standbyEnabled: event.standby_enabled ?? false,
    live: event.live ?? false,
  };
}

function eventToFormData(event: Event): FormData {
  return {
    name: event.name || "",
    desc: event.desc || "",
    tagline: event.tagline || "",
    capacity: event.capacity?.toString() || "",
    tickets: event.tickets?.toString() || "",
    reserved: event.reserved?.toString() || "",
    venue: event.venue || "",
    venue_link: event.venue_link || "",
    release_date: formatDateTimeForInput(event.release_date),
    ticketing_date: formatDateTimeForInput(event.ticketing_date ?? null),
    start_time_date: formatDateTimeForInput(event.start_time_date),
    end_time_date: formatDateTimeForInput(event.end_time_date),
    doors_open: formatDateTimeForInput(event.doors_open),
    route: event.route || "",
    priority:
      event.priority || "This event is only open to Stanford affiliates",
    ticketing_roles:
      event.ticketing_roles && event.ticketing_roles.length > 0
        ? [...event.ticketing_roles]
        : [...DEFAULT_TICKETING_ROLES],
    hide_ticketing_date: event.hide_ticketing_date || false,
    referrals_enabled: event.referrals_enabled || false,
    standby_enabled: event.standby_enabled || false,
    livestream: event.livestream || "",
    latitude: event.latitude?.toString() || "",
    longitude: event.longitude?.toString() || "",
    address: event.address || "",
    external_ticketing_enabled: event.external_ticketing_enabled || false,
    external_ticketing_url: event.external_ticketing_url || "",
    banner_eligible: event.banner_eligible ?? true,
    identity_verification_enabled: event.identity_verification_enabled ?? true,
    allow_admitting_standby: event.allow_admitting_standby ?? false,
  };
}

function readFilePreview(file: File, onLoad: (result: string) => void) {
  const reader = new FileReader();
  reader.onloadend = () => {
    onLoad(reader.result as string);
  };
  reader.readAsDataURL(file);
}

async function getImageDimensions(
  file: File,
): Promise<{ width: number; height: number }> {
  const objectUrl = URL.createObjectURL(file);

  try {
    const dimensions = await new Promise<{ width: number; height: number }>(
      (resolve, reject) => {
        const image = new window.Image();
        image.onload = () => {
          resolve({
            width: image.naturalWidth,
            height: image.naturalHeight,
          });
        };
        image.onerror = () => {
          reject(new Error("Unable to read image dimensions."));
        };
        image.src = objectUrl;
      },
    );

    return dimensions;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function validateAppleWalletImage(file: File): Promise<void> {
  const lowerFileName = file.name.toLowerCase();
  if (!lowerFileName.endsWith(".png")) {
    throw new Error("Apple Wallet image must be a PNG.");
  }

  if (file.type && file.type !== "image/png") {
    throw new Error("Apple Wallet image must be a PNG.");
  }

  const { width, height } = await getImageDimensions(file);
  const aspectRatio = width / height;

  if (
    Math.abs(aspectRatio - APPLE_WALLET_STRIP_RATIO) >
    APPLE_WALLET_STRIP_RATIO_TOLERANCE
  ) {
    throw new Error(
      "Apple Wallet image must use the 375:98 strip ratio, such as 1125x294px.",
    );
  }

  if (width < APPLE_WALLET_MIN_WIDTH || height < APPLE_WALLET_MIN_HEIGHT) {
    throw new Error(
      "Apple Wallet image must be at least 1125x294px for crisp Wallet rendering.",
    );
  }
}

type EditEventClientProps = {
  allEvents: Event[];
};

export default function EditEventClient({ allEvents }: EditEventClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { selectedEventId, setSelectedEventId, upsertEvent } =
    useEventContext();
  const [events, setEvents] = useState<Event[]>(allEvents);
  const isCreating = searchParams.get("create") === "1";

  const currentEvent = events.find((e) => e.id === selectedEventId) ?? null;

  const [formData, setFormData] = useState<FormData>(
    currentEvent ? eventToFormData(currentEvent) : emptyForm,
  );
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(
    currentEvent?.image_url || null,
  );
  const [mobileImageFile, setMobileImageFile] = useState<File | null>(null);
  const [mobileImagePreview, setMobileImagePreview] = useState<string | null>(
    currentEvent?.mobile_image_url || null,
  );
  const [appleWalletImageFile, setAppleWalletImageFile] = useState<File | null>(
    null,
  );
  const [appleWalletImagePreview, setAppleWalletImagePreview] = useState<
    string | null
  >(currentEvent?.apple_wallet_image_url || null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mobileFileInputRef = useRef<HTMLInputElement>(null);
  const appleWalletFileInputRef = useRef<HTMLInputElement>(null);
  const lastSyncedViewKeyRef = useRef<string | null>(null);
  // Which section the tabbed form layout is showing.
  const [activeEditSection, setActiveEditSection] = useState("basics");

  useEffect(() => {
    setEvents(allEvents);
  }, [allEvents]);

  useEffect(() => {
    if (!success) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setSuccess(null);
    }, 1800);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [success]);

  useEffect(() => {
    if (isCreating || !currentEvent) {
      return;
    }

    // The URL is the source of truth here (EventSync reconciles context to it),
    // so only canonicalize when the URL has no usable event id — the bare
    // /events/edit route, or an id that no longer exists. When the URL already
    // points at a valid event, leave it alone; otherwise this redirect would
    // fight EventSync and ping-pong the selection.
    const urlId = pathname.startsWith("/events/edit/")
      ? pathname.slice("/events/edit/".length).split("/")[0]
      : null;
    const urlHasValidEvent = !!urlId && events.some((e) => e.id === urlId);
    if (urlHasValidEvent) {
      return;
    }

    const canonicalPath = `/events/edit/${currentEvent.id}`;
    if (pathname !== canonicalPath) {
      router.replace(canonicalPath);
    }
  }, [currentEvent, events, isCreating, pathname, router]);

  // Sync form when selected event changes
  useEffect(() => {
    const syncKey = isCreating
      ? "create"
      : currentEvent
        ? currentEvent.id
        : "empty";

    // Preserve local edits and just-saved state unless the user is actually
    // switching which event view they are on.
    if (lastSyncedViewKeyRef.current === syncKey) {
      return;
    }

    lastSyncedViewKeyRef.current = syncKey;

    if (isCreating) {
      setFormData(emptyForm);
      setImagePreview(null);
      setMobileImagePreview(null);
      setAppleWalletImagePreview(null);
    } else if (currentEvent) {
      setFormData(eventToFormData(currentEvent));
      setImagePreview(currentEvent.image_url || null);
      setMobileImagePreview(currentEvent.mobile_image_url || null);
      setAppleWalletImagePreview(currentEvent.apple_wallet_image_url || null);
    } else {
      setFormData(emptyForm);
      setImagePreview(null);
      setMobileImagePreview(null);
      setAppleWalletImagePreview(null);
    }
    setImageFile(null);
    setMobileImageFile(null);
    setAppleWalletImageFile(null);
    setError(null);
    setSuccess(null);
  }, [selectedEventId, isCreating, currentEvent]);

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      readFilePreview(file, setImagePreview);
    }
  }

  function handleMobileImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setMobileImageFile(file);
      readFilePreview(file, setMobileImagePreview);
    }
  }

  async function handleAppleWalletImageChange(
    e: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      await validateAppleWalletImage(file);
      setAppleWalletImageFile(file);
      readFilePreview(file, setAppleWalletImagePreview);
      setError(null);
    } catch (err) {
      e.target.value = "";
      setAppleWalletImageFile(null);
      setError(
        err instanceof Error ? err.message : "Apple Wallet image is invalid.",
      );
    }
  }

  function handleStartCreate() {
    router.push("/events/edit?create=1");
  }

  function handleCancelCreate() {
    if (currentEvent) {
      router.push(`/events/edit/${currentEvent.id}`);
      return;
    }

    router.push("/events/edit");
  }

  function handleTicketingRoleToggle(role: TicketingRole, checked: boolean) {
    setFormData((prev) => ({
      ...prev,
      ticketing_roles: checked
        ? prev.ticketing_roles.includes(role)
          ? prev.ticketing_roles
          : [...prev.ticketing_roles, role]
        : prev.ticketing_roles.filter((value) => value !== role),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      if (formData.release_date && formData.ticketing_date) {
        const publish = new Date(formData.release_date);
        const ticketing = new Date(formData.ticketing_date);
        if (
          Number.isNaN(publish.getTime()) ||
          Number.isNaN(ticketing.getTime())
        ) {
          setError("Invalid date format");
          return;
        }
        if (ticketing.getTime() < publish.getTime()) {
          setError("Ticketing date must be on or after the release date.");
          return;
        }
      }

      if (formData.start_time_date && formData.end_time_date) {
        const start = new Date(formData.start_time_date);
        const end = new Date(formData.end_time_date);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
          setError("Invalid date format");
          return;
        }
        if (end.getTime() < start.getTime()) {
          setError("End time must be on or after the event start time.");
          return;
        }
      }

      if (
        !formData.external_ticketing_enabled &&
        formData.ticketing_roles.length === 0
      ) {
        setError("Select at least one eligible role for ticketing.");
        return;
      }

      if (
        formData.external_ticketing_enabled &&
        !formData.external_ticketing_url.trim()
      ) {
        setError(
          "External ticketing URL is required when external ticketing is enabled.",
        );
        return;
      }

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
      submitData.append("ticketing_date", formData.ticketing_date);
      submitData.append("start_time_date", formData.start_time_date);
      submitData.append("end_time_date", formData.end_time_date);
      submitData.append("doors_open", formData.doors_open);
      submitData.append("route", formData.route);
      submitData.append("priority", formData.priority);
      submitData.append(
        "hide_ticketing_date",
        formData.hide_ticketing_date.toString(),
      );
      submitData.append(
        "referrals_enabled",
        formData.referrals_enabled.toString(),
      );
      submitData.append("standby_enabled", formData.standby_enabled.toString());
      submitData.append(
        "identity_verification_enabled",
        formData.identity_verification_enabled.toString(),
      );
      submitData.append(
        "allow_admitting_standby",
        formData.allow_admitting_standby.toString(),
      );
      submitData.append("livestream", formData.livestream);
      submitData.append("latitude", formData.latitude);
      submitData.append("longitude", formData.longitude);
      submitData.append("address", formData.address);
      submitData.append(
        "external_ticketing_enabled",
        formData.external_ticketing_enabled.toString(),
      );
      submitData.append(
        "external_ticketing_url",
        formData.external_ticketing_url,
      );
      submitData.append("banner_eligible", formData.banner_eligible.toString());
      formData.ticketing_roles.forEach((role) => {
        submitData.append("ticketing_roles", role);
      });

      if (imageFile) {
        submitData.append("image", imageFile);
      }
      if (mobileImageFile) {
        submitData.append("mobile_image", mobileImageFile);
      }
      if (appleWalletImageFile) {
        submitData.append("apple_wallet_image", appleWalletImageFile);
      }

      if (!isCreating && currentEvent) {
        submitData.append("id", currentEvent.id);
      }

      const response = await fetch("/api/events", {
        method: "POST",
        body: submitData,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to save event");
        return;
      }

      const savedEvent = data.event as Event;
      setEvents((prev) => {
        const exists = prev.some((event) => event.id === savedEvent.id);
        if (exists) {
          return sortEvents(
            prev.map((event) =>
              event.id === savedEvent.id ? savedEvent : event,
            ),
          );
        }

        return sortEvents([savedEvent, ...prev]);
      });
      upsertEvent(toEventOption(savedEvent));
      setFormData(eventToFormData(savedEvent));
      setImagePreview(savedEvent.image_url || null);
      setMobileImagePreview(savedEvent.mobile_image_url || null);
      setAppleWalletImagePreview(savedEvent.apple_wallet_image_url || null);
      setImageFile(null);
      setMobileImageFile(null);
      setAppleWalletImageFile(null);
      setSelectedEventId(savedEvent.id);
      setSuccess(isCreating ? "Event created!" : "Changes saved!");

      if (isCreating) {
        router.push(`/events/edit/${savedEvent.id}`);
      } else {
        router.refresh();
      }
    } catch (err) {
      console.error("Failed to save event:", err);
      setError("Failed to save event. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const editingEvent = isCreating ? null : currentEvent;
  const hasEvent = !!selectedEventId && !!currentEvent;
  const mobileImageDisplayPreview = mobileImagePreview || imagePreview;
  const saveToastMessage = isSubmitting
    ? isCreating
      ? "Saving event..."
      : "Saving changes..."
    : success;

  // ── Form sections, defined once and arranged by each layout variant. ──────
  const editSections: {
    id: string;
    title: string;
    description: string;
    content: React.ReactNode;
  }[] = [
    {
      id: "basics",
      title: "Basics",
      description: "Identity and copy for the event page.",
      content: (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label className="block">Speaker name</Label>
              <Input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label className="block">URL route</Label>
              <div className="flex items-center">
                <span className="text-zinc-500 pr-2">/events/</span>
                <Input
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
                  className="flex-1"
                />
              </div>
            </div>
          </div>
          <MarkdownEditor
            label="Tagline"
            value={formData.tagline}
            onChange={(v) => setFormData({ ...formData, tagline: v })}
            placeholder="Short tagline for the speaker..."
            rows={2}
          />
          <MarkdownEditor
            label="Description"
            value={formData.desc}
            onChange={(v) => setFormData({ ...formData, desc: v })}
            placeholder="Event description..."
            rows={4}
          />
          <MarkdownEditor
            label="Priority Notice"
            value={formData.priority}
            onChange={(v) => setFormData({ ...formData, priority: v })}
            placeholder="e.g. This event is only open to Stanford affiliates"
            rows={2}
          />
          <Well className="cursor-pointer">
            <label className="flex items-start gap-3 cursor-pointer">
              <Checkbox
                checked={formData.banner_eligible}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    banner_eligible: e.target.checked,
                  })
                }
                className="mt-0.5"
              />
              <span className="text-sm text-zinc-300">
                <span className="font-medium text-zinc-200">
                  Promote in site banner &amp; popup
                </span>
                <span className="block text-xs text-zinc-500 mt-0.5">
                  When off, this event is hidden from the top banner and
                  homepage popup. The event page itself stays reachable.
                </span>
              </span>
            </label>
          </Well>
        </>
      ),
    },
    {
      id: "schedule",
      title: "Schedule",
      description: "All times in Pacific Time.",
      content: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-2">
            <Label className="block">
              Release date{" "}
              <span className="text-zinc-500 font-normal">
                (reveal speaker)
              </span>
            </Label>
            <Input
              type="datetime-local"
              value={formData.release_date}
              onChange={(e) =>
                setFormData({ ...formData, release_date: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label className="block">Doors open</Label>
            <Input
              type="datetime-local"
              value={formData.doors_open}
              onChange={(e) =>
                setFormData({ ...formData, doors_open: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label className="block">Event start</Label>
            <Input
              type="datetime-local"
              value={formData.start_time_date}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  start_time_date: e.target.value,
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label className="block">Event end</Label>
            <Input
              type="datetime-local"
              value={formData.end_time_date}
              onChange={(e) =>
                setFormData({ ...formData, end_time_date: e.target.value })
              }
            />
            {formData.start_time_date &&
              formData.end_time_date &&
              (() => {
                const start = new Date(formData.start_time_date);
                const end = new Date(formData.end_time_date);
                if (
                  Number.isNaN(start.getTime()) ||
                  Number.isNaN(end.getTime())
                )
                  return null;
                if (end.getTime() < start.getTime()) {
                  return (
                    <p className="mt-2 text-sm text-rose-400">
                      End time must be on or after the event start time.
                    </p>
                  );
                }
                return null;
              })()}
          </div>
        </div>
      ),
    },
    {
      id: "location",
      title: "Location",
      description: "Venue details and map coordinates.",
      content: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-2">
            <Label className="block">Venue</Label>
            <Input
              type="text"
              value={formData.venue}
              onChange={(e) =>
                setFormData({ ...formData, venue: e.target.value })
              }
              placeholder="e.g., Memorial Auditorium"
            />
          </div>
          <div className="space-y-2">
            <Label className="block">Venue link (Google Maps)</Label>
            <Input
              type="url"
              value={formData.venue_link}
              onChange={(e) =>
                setFormData({ ...formData, venue_link: e.target.value })
              }
              placeholder="https://maps.google.com/..."
            />
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label className="block">Address</Label>
            <Input
              type="text"
              value={formData.address}
              onChange={(e) =>
                setFormData({ ...formData, address: e.target.value })
              }
              placeholder="123 Main St, City, State 12345"
            />
          </div>
          {!formData.external_ticketing_enabled && (
            <>
              <div className="space-y-2">
                <Label className="block">
                  Latitude <span className="text-rose-400">*</span>
                </Label>
                <Input
                  type="number"
                  step="any"
                  value={formData.latitude}
                  onChange={(e) =>
                    setFormData({ ...formData, latitude: e.target.value })
                  }
                  placeholder="e.g., 37.7749"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label className="block">
                  Longitude <span className="text-rose-400">*</span>
                </Label>
                <Input
                  type="number"
                  step="any"
                  value={formData.longitude}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      longitude: e.target.value,
                    })
                  }
                  placeholder="e.g., -122.4194"
                  required
                />
              </div>
            </>
          )}
          <div className="md:col-span-2 space-y-2">
            <Label className="block">Livestream URL</Label>
            <Input
              type="text"
              value={formData.livestream}
              onChange={(e) =>
                setFormData({ ...formData, livestream: e.target.value })
              }
              placeholder="https://youtube.com/..."
            />
          </div>
        </div>
      ),
    },
    {
      id: "ticketing",
      title: "Ticketing",
      description: formData.external_ticketing_enabled
        ? "Tickets are handled by an external provider. The “Get Tickets” button redirects to the URL below."
        : "Configure ticket sales on our platform.",
      content: (
        <>
          <Well className="space-y-3">
            <Checkbox
              checked={formData.external_ticketing_enabled}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  external_ticketing_enabled: e.target.checked,
                })
              }
              label={
                <span className="font-medium text-zinc-200">
                  Use external ticketing
                </span>
              }
            />
            {formData.external_ticketing_enabled && (
              <div className="space-y-2">
                <Label className="block">External ticketing URL</Label>
                <Input
                  type="url"
                  value={formData.external_ticketing_url}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      external_ticketing_url: e.target.value,
                    })
                  }
                  placeholder="https://eventbrite.com/.../..."
                />
              </div>
            )}
          </Well>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label className="block">
                Ticketing date{" "}
                <span className="text-zinc-500 font-normal">
                  (sales open, PT)
                </span>
              </Label>
              <Input
                type="datetime-local"
                value={formData.ticketing_date}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    ticketing_date: e.target.value,
                  })
                }
              />
              {formData.release_date &&
                formData.ticketing_date &&
                (() => {
                  const publish = new Date(formData.release_date);
                  const ticketing = new Date(formData.ticketing_date);
                  if (
                    Number.isNaN(publish.getTime()) ||
                    Number.isNaN(ticketing.getTime())
                  )
                    return null;
                  if (ticketing.getTime() < publish.getTime()) {
                    return (
                      <p className="mt-2 text-sm text-rose-400">
                        Ticketing date must be on or after the release date.
                      </p>
                    );
                  }
                  return null;
                })()}
            </div>
            <div className="flex items-end pb-3">
              <Checkbox
                checked={formData.hide_ticketing_date}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    hide_ticketing_date: e.target.checked,
                  })
                }
                label={
                  <span className="font-medium text-zinc-300">
                    Hide ticketing date from the public page
                  </span>
                }
              />
            </div>
          </div>

          {!formData.external_ticketing_enabled && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-2">
                  <Label className="block">Capacity</Label>
                  <Input
                    type="number"
                    value={formData.capacity}
                    onChange={(e) =>
                      setFormData({ ...formData, capacity: e.target.value })
                    }
                    placeholder="e.g., 500"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="block">
                    Reserved seats{" "}
                    <span className="text-zinc-500 font-normal">
                      (optional)
                    </span>
                  </Label>
                  <Input
                    type="number"
                    value={formData.reserved}
                    onChange={(e) =>
                      setFormData({ ...formData, reserved: e.target.value })
                    }
                    placeholder="e.g., 50"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="block">Tickets sold</Label>
                  <Input
                    type="number"
                    value={formData.tickets}
                    disabled
                    placeholder="0"
                    className="text-zinc-400 cursor-not-allowed"
                  />
                </div>
              </div>

              <Well>
                <div className="mb-3">
                  <Label className="block">Eligible ticketing roles</Label>
                  <p className="mt-1 text-sm text-zinc-500">
                    Only signed-in users with one of these affiliations can get
                    tickets or join the waitlist.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                  {TICKETING_ROLE_OPTIONS.map((role) => {
                    const checked = formData.ticketing_roles.includes(
                      role.value,
                    );

                    return (
                      <label
                        key={role.value}
                        className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm ring-1 ring-inset transition-colors cursor-pointer ${
                          checked
                            ? "bg-rose-500/10 text-rose-100 ring-rose-500/40"
                            : "bg-white/5 text-zinc-300 ring-white/10 hover:ring-white/20"
                        }`}
                      >
                        <Checkbox
                          checked={checked}
                          onChange={(e) =>
                            handleTicketingRoleToggle(
                              role.value,
                              e.target.checked,
                            )
                          }
                        />
                        <span>{role.label}</span>
                      </label>
                    );
                  })}
                </div>
              </Well>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Well className="cursor-pointer">
                  <Checkbox
                    checked={formData.standby_enabled}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        standby_enabled: e.target.checked,
                      })
                    }
                    label={
                      <span className="font-medium text-zinc-300">
                        Enable standby line
                      </span>
                    }
                  />
                </Well>
                <Well className="cursor-pointer">
                  <Checkbox
                    checked={formData.referrals_enabled}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        referrals_enabled: e.target.checked,
                      })
                    }
                    label={
                      <span className="font-medium text-zinc-300">
                        Enable referrals
                      </span>
                    }
                  />
                </Well>
              </div>

              <Well>
                <div className="mb-3">
                  <Label className="block">Door scanning</Label>
                  <p className="mt-1 text-sm text-zinc-500">
                    Controls how the check-in scanner behaves at the door.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <label className="flex items-start gap-3 rounded-lg bg-white/5 px-4 py-3 ring-1 ring-inset ring-white/10 cursor-pointer">
                    <Checkbox
                      checked={formData.identity_verification_enabled}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          identity_verification_enabled: e.target.checked,
                        })
                      }
                      className="mt-0.5"
                    />
                    <span>
                      <span className="block text-sm font-medium text-zinc-300">
                        Require identity verification
                      </span>
                      <span className="mt-0.5 block text-xs text-zinc-500">
                        Scanners get a prompt to check the guest&apos;s photo ID
                        before admitting. Turn off to admit instantly on scan.
                      </span>
                    </span>
                  </label>
                  <label className="flex items-start gap-3 rounded-lg bg-white/5 px-4 py-3 ring-1 ring-inset ring-white/10 cursor-pointer">
                    <Checkbox
                      checked={formData.allow_admitting_standby}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          allow_admitting_standby: e.target.checked,
                        })
                      }
                      className="mt-0.5"
                    />
                    <span>
                      <span className="block text-sm font-medium text-zinc-300">
                        Allow admitting standby
                      </span>
                      <span className="mt-0.5 block text-xs text-zinc-500">
                        When off, scanners hold standby guests (&ldquo;not
                        admitted yet&rdquo;). Turn on once there is space to
                        start letting them in.
                      </span>
                    </span>
                  </label>
                </div>
              </Well>
            </div>
          )}
        </>
      ),
    },
    {
      id: "images",
      title: "Images",
      description: "Artwork for the event page and Apple Wallet passes.",
      content: (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="block">Event image</Label>
              <div className="flex items-start gap-4">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="relative w-32 h-32 bg-white/5 border-2 border-dashed border-white/10 rounded-lg overflow-hidden cursor-pointer hover:border-white/20 transition-colors flex items-center justify-center shrink-0"
                >
                  {imagePreview ? (
                    <Image
                      src={imagePreview}
                      alt="Event image preview"
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <PhotoIcon className="size-6 shrink-0 text-zinc-600" />
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
                <div className="text-sm text-zinc-500 space-y-1">
                  <p>Recommended: 800x800px or larger</p>
                  <p>Supported formats: JPG, PNG, WebP</p>
                  {imageFile && (
                    <p className="text-emerald-400 pt-1">
                      Selected: {imageFile.name}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="block">
                Mobile event image{" "}
                <span className="text-zinc-500 font-normal">(optional)</span>
              </Label>
              <div className="flex items-start gap-4">
                <div
                  onClick={() => mobileFileInputRef.current?.click()}
                  className="relative w-32 h-32 bg-white/5 border-2 border-dashed border-white/10 rounded-lg overflow-hidden cursor-pointer hover:border-white/20 transition-colors flex items-center justify-center shrink-0"
                >
                  {mobileImageDisplayPreview ? (
                    <Image
                      src={mobileImageDisplayPreview}
                      alt="Mobile event image preview"
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <PhotoIcon className="size-6 shrink-0 text-zinc-600" />
                  )}
                </div>
                <input
                  ref={mobileFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleMobileImageChange}
                  className="hidden"
                />
                <div className="text-sm text-zinc-500 space-y-1">
                  <p>Shown on mobile event pages only.</p>
                  <p>Leave extra space near the top for safe cropping.</p>
                  <p>Avoid faces or key text near the top edge.</p>
                  <p>Falls back to the regular event image when omitted.</p>
                  {mobileImageFile && (
                    <p className="text-emerald-400 pt-1">
                      Selected: {mobileImageFile.name}
                    </p>
                  )}
                  {!mobileImageFile && !mobileImagePreview && imagePreview && (
                    <p className="text-zinc-400 pt-1">
                      Previewing the regular event image as the fallback.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {!formData.external_ticketing_enabled && (
            <div className="space-y-2">
              <Label className="block">Apple Wallet image</Label>
              <div className="flex items-start gap-4">
                <div
                  onClick={() => appleWalletFileInputRef.current?.click()}
                  className="relative w-56 h-[58px] bg-white/5 border-2 border-dashed border-white/10 rounded-lg overflow-hidden cursor-pointer hover:border-white/20 transition-colors flex items-center justify-center shrink-0"
                >
                  {appleWalletImagePreview ? (
                    <Image
                      src={appleWalletImagePreview}
                      alt="Apple Wallet image preview"
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <PhotoIcon className="size-6 shrink-0 text-zinc-600" />
                  )}
                </div>
                <input
                  ref={appleWalletFileInputRef}
                  type="file"
                  accept="image/png"
                  onChange={handleAppleWalletImageChange}
                  className="hidden"
                />
                <div className="text-sm text-zinc-500 space-y-1">
                  <p>Used for Apple Wallet passes only.</p>
                  <p>Required format: PNG at the 375:98 strip ratio.</p>
                  <p>Recommended size: 1125x294px or larger.</p>
                  <p>Keep text, faces, and logos away from the edges.</p>
                  {appleWalletImageFile && (
                    <p className="text-emerald-400 pt-1">
                      Selected: {appleWalletImageFile.name}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      ),
    },
  ];

  const saveButtons = (
    <>
      <Button
        type="submit"
        variant="primary"
        disabled={isSubmitting}
        className="flex items-center gap-2"
      >
        {isSubmitting ? (
          <div className="size-4 shrink-0 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <CheckIcon className="size-4 shrink-0" />
        )}
        {editingEvent ? "Save changes" : "Create event"}
      </Button>
      {isCreating && (
        <Button type="button" variant="ghost" onClick={handleCancelCreate}>
          Cancel
        </Button>
      )}
    </>
  );

  return (
    <div className="px-4 sm:px-6 py-8">
      <div className="mb-8">
        <PageHeader
          title={isCreating ? "Create new event" : "Edit event"}
          subtitle={
            hasEvent && !isCreating
              ? `Editing: ${currentEvent?.name || "Unnamed Event"}`
              : undefined
          }
        >
          {!isCreating && (
            <Button
              onClick={handleStartCreate}
              className="flex items-center gap-2"
            >
              <PlusIcon className="size-4 shrink-0" />
              New event
            </Button>
          )}
        </PageHeader>
      </div>

      {error && (
        <div className="mb-6">
          <Alert tone="error" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        </div>
      )}

      {!hasEvent && !isCreating ? (
        <EmptyState
          title="No event selected"
          hint="Select an event from the sidebar, or create a new one."
        >
          <Button
            variant="primary"
            onClick={handleStartCreate}
            className="inline-flex items-center gap-2"
          >
            <PlusIcon className="size-4 shrink-0" />
            Create event
          </Button>
        </EmptyState>
      ) : (
        <>
          {isCreating && (
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-serif text-xl font-semibold text-white">
                New event
              </h2>
              <Button
                variant="ghost"
                onClick={handleCancelCreate}
                aria-label="Cancel"
              >
                <XMarkIcon className="size-4 shrink-0" />
              </Button>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <Card>
              <Tabs wrap role="tablist">
                {editSections.map((s) => (
                  <Tab
                    key={s.id}
                    active={activeEditSection === s.id}
                    onClick={() => setActiveEditSection(s.id)}
                  >
                    {s.title}
                  </Tab>
                ))}
              </Tabs>
              <div className="py-6">
                {editSections.map((s) => (
                  <div
                    key={s.id}
                    hidden={activeEditSection !== s.id}
                    className="space-y-5"
                  >
                    <SectionHeader
                      title={s.title}
                      description={s.description}
                    />
                    {s.content}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-4 border-t border-white/10 pt-4">
                {saveButtons}
              </div>
            </Card>
          </form>
        </>
      )}

      {saveToastMessage && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
          <div className="flex items-center gap-3 rounded-full border border-white/10 bg-zinc-900/95 px-5 py-3 shadow-2xl shadow-black/30 backdrop-blur">
            {isSubmitting ? (
              <div className="h-5 w-5 rounded-full border-2 border-emerald-300/80 border-t-transparent animate-spin" />
            ) : (
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20">
                <CheckIcon className="size-3.5 shrink-0 text-emerald-400" />
              </div>
            )}
            <p className="text-sm font-medium text-white">{saveToastMessage}</p>
          </div>
        </div>
      )}
    </div>
  );
}
