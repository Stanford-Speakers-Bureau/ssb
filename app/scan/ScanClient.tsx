"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Html5Qrcode } from "html5-qrcode";

type TicketStatus = "scanned" | "already_scanned" | "invalid" | "valid" | "id_mismatch" | null;

type TicketInfo = {
  id: string;
  type: string | null;
  scanned: boolean;
  scan_time: string | null;
  email: string | null;
  name: string | null;
  scan_user: string | null;
  scan_email: string | null;
};

type LiveEvent = {
  id: string;
  name: string | null;
  venue: string | null;
  start_time_date: string | null;
  scanned?: number;
  totalSold?: number;
} | null;

type ScanMode = "hold" | "always";

const SCAN_MODE_STORAGE_KEY = "ssb:scan_mode";

function readStoredScanMode(): ScanMode {
  if (typeof window === "undefined") return "hold";
  try {
    const raw = window.localStorage.getItem(SCAN_MODE_STORAGE_KEY);
    return raw === "always" ? "always" : "hold";
  } catch {
    return "hold";
  }
}

type ErrorLike = {
  name?: string;
  message?: string;
};

function isStandbyType(type: string | null | undefined): boolean {
  return (type ?? "").toLowerCase().trim() === "standby";
}

function isVipType(type: string | null | undefined): boolean {
  return (type ?? "").toLowerCase().trim() === "vip";
}

function getErrorLike(error: unknown): ErrorLike {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }
  if (typeof error === "object" && error !== null) {
    const record = error as Record<string, unknown>;
    return {
      name: typeof record.name === "string" ? record.name : undefined,
      message: typeof record.message === "string" ? record.message : undefined,
    };
  }
  if (typeof error === "string") {
    return { message: error };
  }
  return {};
}

export default function ScanClient() {
  const [status, setStatus] = useState<TicketStatus>(null);
  const [ticketInfo, setTicketInfo] = useState<TicketInfo | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<
    "prompt" | "granted" | "denied" | "checking"
  >("prompt");
  const [cameraStarted, setCameraStarted] = useState(false);
  const [scanMode, setScanMode] = useState<ScanMode>("hold");
  const [isHolding, setIsHolding] = useState(false);
  const [liveEvent, setLiveEvent] = useState<LiveEvent>(null);
  const [emailSUNET, setEmailSUNET] = useState<string>("");
  const [isMobile, setIsMobile] = useState(true);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [searchResults, setSearchResults] = useState<TicketInfo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchAbortRef = useRef<AbortController | null>(null);
  const [pendingTicket, setPendingTicket] = useState<TicketInfo | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const showConfirmationRef = useRef(false);
  const pendingTicketIdRef = useRef<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scanAreaRef = useRef<HTMLDivElement>(null);
  const stopInFlightRef = useRef<Promise<void> | null>(null);
  const statusTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const stopScanner = useCallback(async () => {
    // Idempotent stop: if we already stopped or are stopping, reuse that.
    if (stopInFlightRef.current) return stopInFlightRef.current;

    const scanner = scannerRef.current;
    if (!scanner) return;

    // Prevent double-stop/clear (especially on WebKit / React dev double-invoke)
    scannerRef.current = null;

    stopInFlightRef.current = (async () => {
      try {
        // `stop()` can throw if not running; ignore those cases.
        await scanner.stop();
      } catch (err: unknown) {
        const errorInfo = getErrorLike(err);
        const msg = String(errorInfo.message || err || "");
        if (
          !msg.toLowerCase().includes("not running") &&
          !msg.toLowerCase().includes("already stopped")
        ) {
          console.error("Error stopping scanner:", err);
        }
      }

      // WebKit can throw: "Argument 1 ('child') to Node.removeChild must be an instance of Node"
      // if `clear()` is called after the DOM has been manipulated/removed.
      try {
        const el = scanAreaRef.current;
        if (el && el.childNodes && el.childNodes.length > 0) {
          scanner.clear();
        }
      } catch (err) {
        // Swallow clear errors; they are non-fatal and common on WebKit.
        console.debug("Scanner clear skipped:", err);
      }

      setCameraStarted(false);
      stopInFlightRef.current = null;
    })();

    return stopInFlightRef.current;
  }, []);

  // Keep ref in sync so handleScan can check without re-creating
  useEffect(() => {
    showConfirmationRef.current = showConfirmation;
  }, [showConfirmation]);

  // Restore scan-mode preference from localStorage on mount.
  useEffect(() => {
    setScanMode(readStoredScanMode());
  }, []);

  // Persist mode changes.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(SCAN_MODE_STORAGE_KEY, scanMode);
    } catch {
      // Storage might be disabled / quota — non-fatal.
    }
  }, [scanMode]);

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      // Check if it's a mobile device based on screen width and touch capability
      const isMobileDevice =
        window.innerWidth < 768 || // Tablet/mobile breakpoint
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent,
        ) ||
        Boolean(navigator.maxTouchPoints && navigator.maxTouchPoints > 2);
      setIsMobile(isMobileDevice);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const fetchLiveEvent = async () => {
    try {
      const response = await fetch("/api/events/live");
      const data = (await response.json()) as { liveEvent?: LiveEvent };
      setLiveEvent(data.liveEvent || null);
    } catch (error) {
      console.error("Error fetching live event:", error);
      setLiveEvent(null);
    }
  };

  // Fetch live event on mount
  useEffect(() => {
    fetchLiveEvent();
    // Refresh live event every 30 seconds
    const interval = setInterval(fetchLiveEvent, 30000);
    return () => clearInterval(interval);
  }, []);

  // Check camera permission on mount
  useEffect(() => {
    const checkCameraPermission = async () => {
      try {
        // Check if Permissions API is available and supported
        if (
          navigator.permissions &&
          navigator.permissions.query &&
          typeof navigator.permissions.query === "function"
        ) {
          try {
            const permissionStatus = await navigator.permissions.query({
              name: "camera" as PermissionName,
            });
            setCameraPermission(
              permissionStatus.state === "granted"
                ? "granted"
                : permissionStatus.state === "denied"
                  ? "denied"
                  : "prompt",
            );

            // Listen for permission changes
            permissionStatus.onchange = () => {
              setCameraPermission(
                permissionStatus.state === "granted"
                  ? "granted"
                  : permissionStatus.state === "denied"
                    ? "denied"
                    : "prompt",
              );
            };
          } catch {
            // Permissions API might not support "camera" on WebKit
            // Fall through to getUserMedia check
            console.log(
              "Permissions API not fully supported, using getUserMedia check",
            );
            setCameraPermission("prompt");
          }
        } else {
          // Permissions API not available (common on WebKit/iOS Safari)
          // Set to prompt and let getUserMedia handle the permission request
          setCameraPermission("prompt");
        }
      } catch (error) {
        console.error("Error checking camera permission:", error);
        // Default to prompt for WebKit browsers
        setCameraPermission("prompt");
      }
    };

    checkCameraPermission();
  }, []);

  // Track last scanned ID to prevent duplicate scans
  const lastScannedRef = useRef<string | null>(null);
  const scanCooldownRef = useRef<number>(0);

  // Handle scan results - GET lookup first, then confirm before marking scanned
  const handleScan = useCallback(async (id: string) => {
    if (!id.trim()) return;

    // Ignore scans while confirmation modal is open
    if (showConfirmationRef.current) return;

    // Prevent duplicate scans within 3 seconds
    const now = Date.now();
    if (lastScannedRef.current === id && now - scanCooldownRef.current < 3000) {
      return;
    }

    setEmailSUNET("");

    lastScannedRef.current = id;
    scanCooldownRef.current = now;

    // Clear any existing timeout
    if (statusTimeoutRef.current) {
      clearTimeout(statusTimeoutRef.current);
      statusTimeoutRef.current = null;
    }

    // Reset status immediately so background snaps back to black
    setStatus(null);
    setTicketInfo(null);

    setIsLoading(true);
    try {
      // Step 1: GET lookup only (no side effects)
      const response = await fetch(
        `/api/scan?ticket_id=${encodeURIComponent(id.trim())}`,
      );

      const data = (await response.json()) as {
        status?: TicketStatus;
        ticket?: TicketInfo;
      };

      const ticketStatus = data.status ?? "invalid";

      if (ticketStatus === "valid" && data.ticket) {
        // Step 2: Show confirmation modal for valid tickets
        setPendingTicket(data.ticket);
        pendingTicketIdRef.current = data.ticket.id;
        setShowConfirmation(true);
      } else {
        // Already scanned or invalid - show immediate feedback
        setStatus(ticketStatus === "valid" ? null : ticketStatus);
        setTicketInfo(data.ticket ?? null);
        await fetchLiveEvent();

        statusTimeoutRef.current = setTimeout(() => {
          setStatus(null);
          setTicketInfo(null);
          statusTimeoutRef.current = null;
        }, 3000);
      }
    } catch (error) {
      console.error("Scan error:", error);
      setStatus("invalid");
      setTicketInfo(null);
      await fetchLiveEvent();

      statusTimeoutRef.current = setTimeout(() => {
        setStatus(null);
        setTicketInfo(null);
        statusTimeoutRef.current = null;
      }, 3000);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Open the manual lookup sheet, resetting any previous query/results.
  const openManualEntry = useCallback(() => {
    setEmailSUNET("");
    setSearchResults([]);
    setIsSearching(false);
    setShowManualEntry(true);
  }, []);

  const closeManualEntry = useCallback(() => {
    searchAbortRef.current?.abort();
    setShowManualEntry(false);
    setIsSearching(false);
    setSearchResults([]);
    setEmailSUNET("");
  }, []);

  // Live, debounced search by name / email / SUNET while the sheet is open.
  useEffect(() => {
    if (!showManualEntry) return;
    const q = emailSUNET.trim();

    if (q.length < 2) {
      searchAbortRef.current?.abort();
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const handle = setTimeout(async () => {
      // Cancel any in-flight request so results never arrive out of order.
      searchAbortRef.current?.abort();
      const controller = new AbortController();
      searchAbortRef.current = controller;
      try {
        const response = await fetch(
          `/api/scan/search?q=${encodeURIComponent(q)}`,
          { signal: controller.signal },
        );
        const data = (await response.json()) as { results?: TicketInfo[] };
        if (controller.signal.aborted) return;
        setSearchResults(data.results ?? []);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("Search error:", error);
        setSearchResults([]);
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }, 200);

    return () => clearTimeout(handle);
  }, [emailSUNET, showManualEntry]);

  // Pick a search result: scanned tickets show their status, unscanned ones
  // go straight to the identity / standby confirmation.
  const handleSelectResult = useCallback((ticket: TicketInfo) => {
    closeManualEntry();

    if (statusTimeoutRef.current) {
      clearTimeout(statusTimeoutRef.current);
      statusTimeoutRef.current = null;
    }

    if (ticket.scanned) {
      setStatus("already_scanned");
      setTicketInfo(ticket);
      statusTimeoutRef.current = setTimeout(() => {
        setStatus(null);
        setTicketInfo(null);
        statusTimeoutRef.current = null;
      }, 6000);
      return;
    }

    setPendingTicket(ticket);
    pendingTicketIdRef.current = ticket.id;
    setShowConfirmation(true);
  }, [closeManualEntry]);

  // Confirm scan - POST to mark ticket as scanned
  const handleConfirm = useCallback(async () => {
    if (!pendingTicket) return;
    setIsConfirming(true);
    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket_id: pendingTicketIdRef.current }),
      });
      const data = (await response.json()) as {
        status?: TicketStatus;
        ticket?: TicketInfo;
      };

      // Dismiss confirmation modal
      setShowConfirmation(false);
      setPendingTicket(null);
      pendingTicketIdRef.current = null;

      // Show success/failure overlay
      setStatus(data.status ?? "invalid");
      setTicketInfo(data.ticket ?? null);
      await fetchLiveEvent();

      statusTimeoutRef.current = setTimeout(() => {
        setStatus(null);
        setTicketInfo(null);
        statusTimeoutRef.current = null;
      }, 3000);
    } catch (error) {
      console.error("Confirm scan error:", error);
      setShowConfirmation(false);
      setPendingTicket(null);
      pendingTicketIdRef.current = null;
      setStatus("invalid");

      statusTimeoutRef.current = setTimeout(() => {
        setStatus(null);
        setTicketInfo(null);
        statusTimeoutRef.current = null;
      }, 3000);
    } finally {
      setIsConfirming(false);
    }
  }, [pendingTicket]);

  // Cancel scan - log failed ID check, show standby message
  const handleCancel = useCallback(() => {
    const ticket = pendingTicket;
    setShowConfirmation(false);
    setPendingTicket(null);
    pendingTicketIdRef.current = null;
    // Reset cooldown so the same QR can be re-scanned
    lastScannedRef.current = null;
    scanCooldownRef.current = 0;

    // Show red "send to standby" screen
    if (statusTimeoutRef.current) {
      clearTimeout(statusTimeoutRef.current);
      statusTimeoutRef.current = null;
    }
    setStatus("id_mismatch");
    setTicketInfo(ticket);
    statusTimeoutRef.current = setTimeout(() => {
      setStatus(null);
      setTicketInfo(null);
      statusTimeoutRef.current = null;
    }, 5000);

    // Log failed scan to audit log (fire-and-forget)
    if (ticket) {
      fetch("/api/scan/fail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticket_id: ticket.id,
          ticket_name: ticket.name,
          ticket_email: ticket.email,
        }),
      }).catch((err) => console.error("Failed to log scan failure:", err));
    }
  }, [pendingTicket]);

  // Start camera when permission is granted
  const startCamera = useCallback(async () => {
    // Only allow camera scanning when an event is live
    if (!liveEvent || cameraStarted) return;
    // Ensure the DOM node exists before starting Html5Qrcode
    if (!scanAreaRef.current) return;

    try {
      setCameraError(null);
      setCameraStarted(true);

      // Check if mediaDevices is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error(
          "Camera API not available. Please use a modern browser with camera support.",
        );
      }

      // WebKit-specific: Request camera permission explicitly with proper constraints
      // Use ideal constraints for better WebKit compatibility and higher quality
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: "environment" }, // Prefer back camera
          width: { ideal: 1920, min: 1280 }, // Higher resolution for better scanning
          height: { ideal: 1080, min: 720 },
          aspectRatio: { ideal: 16 / 9 },
        },
      };

      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        // Stop the test stream immediately - we just needed permission
        stream.getTracks().forEach((track) => track.stop());
      } catch (permError: unknown) {
        const errorInfo = getErrorLike(permError);
        setCameraStarted(false);
        // Handle different error types
        if (
          errorInfo.name === "NotAllowedError" ||
          errorInfo.name === "PermissionDeniedError"
        ) {
          setCameraPermission("denied");
          setCameraError(
            "Camera permission denied. Please enable camera access in your browser settings.",
          );
        } else if (errorInfo.name === "NotFoundError") {
          setCameraPermission("denied");
          setCameraError("No camera found on this device.");
        } else if (errorInfo.name === "NotReadableError") {
          setCameraPermission("denied");
          setCameraError("Camera is already in use by another application.");
        } else {
          setCameraPermission("denied");
          setCameraError(
            errorInfo.message ||
              "Failed to access camera. Please check permissions.",
          );
        }
        return;
      }

      const scanner = new Html5Qrcode("qr-reader");

      // Optimized scanner configuration - scan entire camera viewport
      const config = {
        fps: 60, // Higher FPS for faster scanning
        // No qrbox specified - scans entire camera viewport
        aspectRatio: 1.0,
        // Disable verbose logging for better performance on mobile
        verbose: false,
        // Better error correction handling
        rememberLastUsedCamera: true,
      };

      await scanner.start(
        { facingMode: "environment" }, // Use back camera
        config,
        (decodedText) => {
          // QR code detected
          handleScan(decodedText);
        },
        (errorMessage) => {
          // Ignore scanning errors (they're frequent while scanning)
          // But log them for debugging
          if (
            errorMessage &&
            !errorMessage.includes("NotFoundException") &&
            !errorMessage.includes("No MultiFormat Readers")
          ) {
            console.debug("QR scan error:", errorMessage);
          }
        },
      );

      // Only set the ref once the scanner is actually running.
      scannerRef.current = scanner;
      setCameraPermission("granted");
    } catch (error: unknown) {
      const errorInfo = getErrorLike(error);
      console.error("Camera error:", error);
      setCameraStarted(false);
      if (
        errorInfo.message?.includes("permission") ||
        errorInfo.name === "NotAllowedError" ||
        errorInfo.name === "PermissionDeniedError"
      ) {
        setCameraPermission("denied");
        setCameraError(
          "Camera permission denied. Please enable camera access in your browser settings.",
        );
      } else if (errorInfo.name === "NotFoundError") {
        setCameraPermission("denied");
        setCameraError("No camera found on this device.");
      } else {
        setCameraError(
          errorInfo.message ||
            "Failed to access camera. Please check permissions.",
        );
      }
    }
  }, [cameraStarted, handleScan, liveEvent]);

  // Auto-start camera when permission is granted (always-on mode).
  // In hold mode, the camera only runs while the user is pressing the
  // scan area — see the pointer handlers on the qr-reader element.
  useEffect(() => {
    // If the live event gets turned off while scanning, stop the camera.
    if (!liveEvent) {
      void stopScanner();
    }

    if (
      scanMode === "always" &&
      liveEvent &&
      cameraPermission === "granted" &&
      !cameraStarted &&
      scanAreaRef.current
    ) {
      startCamera();
    }

    return () => {
      void stopScanner();
    };
  }, [
    scanMode,
    liveEvent,
    cameraPermission,
    cameraStarted,
    startCamera,
    stopScanner,
  ]);

  // When the user flips to hold mode while the camera is running and they
  // aren't actively pressing, shut the camera off so battery isn't drained
  // until the next hold.
  useEffect(() => {
    if (scanMode === "hold" && cameraStarted && !isHolding) {
      void stopScanner();
    }
  }, [scanMode, cameraStarted, isHolding, stopScanner]);

  const handleHoldStart = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (scanMode !== "hold") return;
      if (!liveEvent) return;
      if (showConfirmationRef.current) return;
      // Skip if the press landed on an interactive control (toggle, input,
      // submit button, status overlay, etc.) — those need normal click
      // behavior. We mark them with data-no-hold elsewhere.
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-no-hold]")) return;
      // Capture so we still get pointerup even if the finger drifts.
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Some browsers / pointer types don't support capture — ignore.
      }
      setIsHolding(true);
      if (!cameraStarted) {
        void startCamera();
      }
    },
    [scanMode, liveEvent, cameraStarted, startCamera],
  );

  const handleHoldEnd = useCallback(() => {
    if (scanMode !== "hold") return;
    if (!isHolding) return;
    setIsHolding(false);
    void stopScanner();
  }, [scanMode, isHolding, stopScanner]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (statusTimeoutRef.current) {
        clearTimeout(statusTimeoutRef.current);
      }
      searchAbortRef.current?.abort();
    };
  }, []);

  const formatScanTime = (scanTime: string | null) => {
    if (!scanTime) return null;
    const date = new Date(scanTime);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  };

  // --- Derived result presentation -----------------------------------------

  const ticketIsVip = isVipType(ticketInfo?.type);
  const ticketIsStandby = isStandbyType(ticketInfo?.type);
  const pendingIsStandby = isStandbyType(pendingTicket?.type);

  // Full-screen result theme: bold, unmissable color + icon for door staff.
  const resultTheme = (() => {
    switch (status) {
      case "scanned":
        return ticketIsVip
          ? { bg: "bg-teal-600", icon: "check", title: "VIP Admitted" }
          : ticketIsStandby
            ? { bg: "bg-green-600", icon: "check", title: "Standby Admitted" }
            : { bg: "bg-green-600", icon: "check", title: "Admitted" };
      case "already_scanned":
        return { bg: "bg-amber-500", icon: "warn", title: "Already Scanned" };
      case "invalid":
        return { bg: "bg-red-600", icon: "x", title: "Invalid Ticket" };
      case "id_mismatch":
        return { bg: "bg-red-600", icon: "x", title: "Send to Standby Line" };
      default:
        return null;
    }
  })();

  const dismissResult = () => {
    if (statusTimeoutRef.current) {
      clearTimeout(statusTimeoutRef.current);
      statusTimeoutRef.current = null;
    }
    setStatus(null);
    setTicketInfo(null);
  };

  // Show desktop message if not on mobile
  if (!isMobile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center font-sans bg-[var(--ssb-paper)] px-6">
        <div className="w-full max-w-md bg-zinc-900 rounded-2xl p-8 sm:p-12 text-center border border-zinc-800">
          <h1 className="text-3xl text-[#A80D0C] mb-6 font-serif">SSB Scanner</h1>
          <svg
            className="w-16 h-16 mx-auto mb-6 text-zinc-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
            />
          </svg>
          <h2 className="text-2xl text-white mb-3 font-serif">
            Open on your phone
          </h2>
          <p className="text-zinc-400 text-base">
            The scanner is built for mobile. Open this page on your phone or
            tablet to scan tickets.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      onPointerDown={handleHoldStart}
      onPointerUp={handleHoldEnd}
      onPointerCancel={handleHoldEnd}
      style={
        scanMode === "hold" && liveEvent
          ? {
              // `none` (not `manipulation`) so a small finger drag isn't read
              // as a pan/scroll — that gesture would fire pointercancel and
              // drop the hold. Combined with pointer capture, the press stays
              // active until the finger actually lifts.
              touchAction: "none",
              WebkitTouchCallout: "none",
              // Stop Safari from highlighting/selecting text while the
              // user holds down to scan.
              userSelect: "none",
              WebkitUserSelect: "none",
              WebkitTapHighlightColor: "transparent",
            }
          : { WebkitTapHighlightColor: "transparent" }
      }
      className="relative h-[100dvh] w-full overflow-hidden bg-black font-sans"
    >
      {/* html5-qrcode chrome cleanup */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            #qr-reader__dashboard_section_swaplink,
            #qr-reader__status_span,
            #qr-reader__camera_selection,
            #qr-reader__dashboard_section_csr,
            #qr-reader__dashboard_section,
            #qr-reader__camera_permission_button_id,
            #qr-reader__camera_permission_denied_id { display: none !important; }
            #qr-reader__scan_region { border: none !important; box-shadow: none !important; }
            #qr-reader, #qr-reader video { width: 100% !important; height: 100% !important; }
            #qr-reader video { object-fit: cover !important; }
          `,
        }}
      />

      {/* ============================ NO LIVE EVENT ============================ */}
      {!liveEvent && (
        <div className="flex h-full flex-col items-center justify-center px-6 text-center">
          <h1 className="text-3xl text-[#A80D0C] mb-8 font-serif">SSB Scanner</h1>
          <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-8">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-yellow-500/15">
              <span className="h-3 w-3 rounded-full bg-yellow-400" />
            </div>
            <p className="mb-1 text-lg font-semibold text-yellow-400">
              No live event
            </p>
            <p className="text-sm text-zinc-400">
              Scanning is disabled until an event goes live.
            </p>
          </div>
        </div>
      )}

      {/* ============================== CAMERA ================================ */}
      {liveEvent && (
        <>
          {/* Camera fills the screen */}
          <div
            id="qr-reader"
            ref={scanAreaRef}
            className={`absolute inset-0 bg-black transition-all duration-300 ${
              isLoading ? "blur-md" : ""
            }`}
          />

          {/* Idle scrim — camera off (hold mode, or before permission) */}
          {!cameraStarted && !isLoading && cameraPermission !== "denied" && (
            <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center bg-zinc-950/92 px-8 text-center">
              {cameraPermission === "prompt" ? (
                <>
                  <CameraIcon className="mb-4 h-14 w-14 text-[#A80D0C]" />
                  <p className="mb-1 text-xl font-semibold text-white">
                    Enable your camera
                  </p>
                  <p className="text-sm text-zinc-400">
                    Tap the button below to allow camera access.
                  </p>
                </>
              ) : scanMode === "hold" ? (
                <>
                  <FingerIcon className="mb-4 h-16 w-16 text-[#A80D0C]" />
                  <p className="mb-1 text-2xl font-bold text-white">
                    Hold or tap to scan
                  </p>
                  <p className="text-sm text-zinc-400">
                    Hold anywhere and release, or tap to start and tap again to
                    stop.
                  </p>
                  <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-green-400">
                    <BatteryIcon className="h-4 w-4" />
                    Camera stays off between scans to save battery
                  </p>
                </>
              ) : (
                <>
                  <CameraIcon className="mb-4 h-14 w-14 text-[#A80D0C]" />
                  <p className="text-lg font-semibold text-white">
                    Starting camera…
                  </p>
                </>
              )}
            </div>
          )}

          {/* Active scan reticle */}
          {cameraStarted && !isLoading && !status && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
              <div className="relative h-[68vw] max-h-[320px] w-[68vw] max-w-[320px]">
                <Corner className="left-0 top-0" />
                <Corner className="right-0 top-0 rotate-90" />
                <Corner className="bottom-0 right-0 rotate-180" />
                <Corner className="bottom-0 left-0 -rotate-90" />
                <motion.div
                  className="absolute inset-x-3 h-0.5 rounded-full bg-[#A80D0C] shadow-[0_0_12px_2px_rgba(168,13,12,0.7)]"
                  initial={{ top: "8%" }}
                  animate={{ top: ["8%", "92%", "8%"] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                />
              </div>
            </div>
          )}

          {/* Loading spinner */}
          {isLoading && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 backdrop-blur-sm">
              <div className="flex flex-col items-center">
                <svg
                  className="h-10 w-10 animate-spin text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <p className="mt-3 text-lg font-semibold text-white">Checking…</p>
              </div>
            </div>
          )}

          {/* ----------------------------- TOP BAR --------------------------- */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 z-30 bg-gradient-to-b from-black/80 to-transparent px-4 pb-8"
            style={{ paddingTop: "max(env(safe-area-inset-top), 0.75rem)" }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-white">
                  {liveEvent.name || "Live event"}
                </p>
                {liveEvent.venue && (
                  <p className="truncate text-xs text-zinc-300">
                    {liveEvent.venue}
                  </p>
                )}
              </div>
              {liveEvent.scanned !== undefined &&
                liveEvent.totalSold !== undefined && (
                  <div className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-sm font-semibold text-white backdrop-blur-sm">
                    {liveEvent.scanned}
                    <span className="text-zinc-400"> / {liveEvent.totalSold}</span>
                  </div>
                )}
            </div>
          </div>

          {/* --------------------------- BOTTOM BAR -------------------------- */}
          <div
            data-no-hold
            className="absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/85 to-transparent px-4 pt-10"
            style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1rem)" }}
          >
            {cameraPermission === "prompt" && (
              <button
                type="button"
                onClick={startCamera}
                className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#A80D0C] py-4 text-lg font-semibold text-white shadow-lg transition-colors active:bg-[#C11211]"
              >
                <CameraIcon className="h-6 w-6" />
                Enable camera
              </button>
            )}

            {cameraPermission === "denied" && (
              <div className="mb-3 rounded-xl border border-red-500/40 bg-red-950/60 p-4 text-center backdrop-blur-sm">
                <p className="mb-1 text-sm font-semibold text-red-300">
                  Camera access denied
                </p>
                <p className="mb-3 text-xs text-zinc-300">
                  Enable camera permissions in your browser settings, then retry.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setCameraPermission("prompt");
                    setCameraError(null);
                  }}
                  className="rounded-lg bg-[#A80D0C] px-5 py-2 text-sm font-semibold text-white active:bg-[#C11211]"
                >
                  Try again
                </button>
              </div>
            )}

            {cameraError && cameraPermission !== "denied" && (
              <p className="mb-3 text-center text-sm text-red-300">{cameraError}</p>
            )}

            <div className="flex items-center gap-2">
              {/* Mode toggle */}
              <div
                role="group"
                aria-label="Scan mode"
                className="flex flex-1 rounded-full border border-white/15 bg-black/40 p-1 backdrop-blur-sm"
              >
                <button
                  type="button"
                  onClick={() => setScanMode("hold")}
                  aria-pressed={scanMode === "hold"}
                  className={`flex-1 rounded-full py-2 text-sm font-semibold transition-colors ${
                    scanMode === "hold"
                      ? "bg-[#A80D0C] text-white"
                      : "text-zinc-300"
                  }`}
                >
                  Hold
                </button>
                <button
                  type="button"
                  onClick={() => setScanMode("always")}
                  aria-pressed={scanMode === "always"}
                  className={`flex-1 rounded-full py-2 text-sm font-semibold transition-colors ${
                    scanMode === "always"
                      ? "bg-[#A80D0C] text-white"
                      : "text-zinc-300"
                  }`}
                >
                  Always on
                </button>
              </div>

              {/* Manual lookup */}
              <button
                type="button"
                onClick={openManualEntry}
                aria-label="Look up by name, email, or SUNET"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white backdrop-blur-sm active:bg-white/10"
              >
                <SearchIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </>
      )}

      {/* =========================== RESULT OVERLAY =========================== */}
      <AnimatePresence>
        {status && resultTheme && (
          <motion.div
            data-no-hold
            key="result"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={dismissResult}
            className={`absolute inset-0 z-40 flex flex-col items-center justify-center px-6 text-center text-white ${resultTheme.bg}`}
          >
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 320, damping: 18 }}
              className="mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-white/20"
            >
              <ResultIcon kind={resultTheme.icon} />
            </motion.div>

            <h2 className="mb-2 font-serif text-3xl sm:text-4xl">
              {resultTheme.title}
            </h2>

            {ticketInfo?.name && (
              <p className="text-2xl font-bold">{ticketInfo.name}</p>
            )}

            <div className="mt-4 w-full max-w-xs space-y-1 text-sm text-white/90">
              {ticketInfo?.email && (
                <p className="break-all">{ticketInfo.email}</p>
              )}
              {ticketInfo?.type && (
                <p className="font-semibold uppercase tracking-wide">
                  {ticketInfo.type} ticket
                </p>
              )}
              {status === "already_scanned" && ticketInfo?.scan_time && (
                <p>Scanned {formatScanTime(ticketInfo.scan_time)}</p>
              )}
              {status === "already_scanned" && ticketInfo?.scan_user && (
                <p>by {ticketInfo.scan_user}</p>
              )}
            </div>

            <p className="absolute bottom-10 text-sm text-white/70">
              Tap anywhere to continue
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========================== MANUAL LOOKUP SHEET ====================== */}
      <AnimatePresence>
        {showManualEntry && liveEvent && (
          <motion.div
            data-no-hold
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeManualEntry}
            className="absolute inset-0 z-50 flex items-start bg-black/70 backdrop-blur-sm"
          >
            {/* Anchored to the top so the iOS keyboard (which slides up from the
                bottom and overlays the viewport) can't cover the input. */}
            <motion.div
              initial={{ y: "-100%" }}
              animate={{ y: 0 }}
              exit={{ y: "-100%" }}
              transition={{ type: "spring", duration: 0.3, bounce: 0.1 }}
              onClick={(e) => e.stopPropagation()}
              className="flex max-h-[80dvh] w-full flex-col rounded-b-2xl border-b border-zinc-700 bg-zinc-900 px-4 pb-4"
              style={{ paddingTop: "max(env(safe-area-inset-top), 0.75rem)" }}
            >
              <div className="mx-auto mb-3 mt-1 h-1 w-10 shrink-0 rounded-full bg-zinc-700" />

              <div className="relative shrink-0">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
                <input
                  id="ticket-search-input"
                  type="text"
                  inputMode="search"
                  autoCapitalize="none"
                  autoCorrect="off"
                  value={emailSUNET}
                  onChange={(e) => setEmailSUNET(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && searchResults.length > 0) {
                      handleSelectResult(searchResults[0]);
                    }
                  }}
                  placeholder="Search name, email, or SUNET"
                  autoFocus
                  style={{ userSelect: "text", WebkitUserSelect: "text" }}
                  className="w-full rounded-xl bg-white/10 py-3 pl-10 pr-10 text-base text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#A80D0C]"
                />
                {emailSUNET && (
                  <button
                    type="button"
                    onClick={() => setEmailSUNET("")}
                    aria-label="Clear"
                    className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-zinc-400 active:bg-white/10"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Results */}
              <div className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain">
                {emailSUNET.trim().length < 2 ? (
                  <p className="py-8 text-center text-sm text-zinc-500">
                    Type at least 2 characters to search.
                  </p>
                ) : isSearching && searchResults.length === 0 ? (
                  <p className="py-8 text-center text-sm text-zinc-400">
                    Searching…
                  </p>
                ) : searchResults.length === 0 ? (
                  <p className="py-8 text-center text-sm text-zinc-400">
                    No matching tickets.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {searchResults.map((t) => (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => handleSelectResult(t)}
                          className="flex w-full items-center gap-3 rounded-xl bg-white/5 px-3 py-3 text-left transition-colors active:bg-white/10"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold text-white">
                              {t.name || t.email || "Unknown"}
                            </p>
                            {t.email && t.name && (
                              <p className="truncate text-xs text-zinc-400">
                                {t.email}
                              </p>
                            )}
                            <div className="mt-0.5 flex items-center gap-2">
                              {t.type && (
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                                  {t.type}
                                </span>
                              )}
                              {isStandbyType(t.type) && (
                                <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-blue-300">
                                  Standby
                                </span>
                              )}
                            </div>
                          </div>
                          {t.scanned ? (
                            <span className="shrink-0 rounded-full bg-amber-500/20 px-2.5 py-1 text-xs font-semibold text-amber-300">
                              Scanned
                            </span>
                          ) : (
                            <span className="shrink-0 rounded-full bg-green-600 px-3 py-1.5 text-xs font-semibold text-white">
                              Admit
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ====================== IDENTITY / STANDBY MODAL ====================== */}
      <AnimatePresence>
        {showConfirmation && pendingTicket && (
          <motion.div
            data-no-hold
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center"
            onClick={handleCancel}
          >
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", duration: 0.32, bounce: 0.12 }}
              className="w-full max-w-sm rounded-t-2xl border-t border-zinc-700 bg-zinc-900 p-6 shadow-2xl sm:rounded-2xl sm:border"
              style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1.5rem)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-center font-serif text-xl text-white">
                Verify identity
              </h3>
              <p className="mb-4 text-center text-sm text-zinc-400">
                Does this name match their photo ID?
              </p>

              <div className="mb-4 rounded-xl bg-zinc-800 p-4 text-center">
                <p className="mb-1 text-2xl font-bold text-white">
                  {pendingTicket.name || "No name on ticket"}
                </p>
                {pendingTicket.email && (
                  <p className="break-all text-sm text-zinc-400">
                    {pendingTicket.email}
                  </p>
                )}
                {pendingTicket.type && (
                  <p className="mt-1 text-xs uppercase tracking-wide text-zinc-500">
                    {pendingTicket.type} ticket
                  </p>
                )}
              </div>

              {/* Blue standby warning */}
              {pendingIsStandby && (
                <div className="mb-4 flex gap-3 rounded-xl border border-blue-400/50 bg-blue-950/60 p-4">
                  <InfoIcon className="mt-0.5 h-5 w-5 shrink-0 text-blue-300" />
                  <div className="text-left">
                    <p className="text-sm font-semibold text-blue-200">
                      Standby ticket
                    </p>
                    <p className="text-xs text-blue-200/80">
                      Admission is not guaranteed. Only admit if there is space.
                      Confirm you want to admit this guest.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={isConfirming}
                  className="flex-1 rounded-xl border border-zinc-600 bg-zinc-700 py-4 text-lg font-semibold text-white transition-colors active:bg-zinc-600 disabled:opacity-50"
                >
                  No
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={isConfirming}
                  className={`flex-1 rounded-xl py-4 text-lg font-semibold text-white transition-colors disabled:opacity-50 ${
                    pendingIsStandby
                      ? "bg-blue-600 active:bg-blue-500"
                      : "bg-green-600 active:bg-green-500"
                  }`}
                >
                  {isConfirming
                    ? "…"
                    : pendingIsStandby
                      ? "Admit standby"
                      : "Admit"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Small presentational helpers -------------------------------------------

function Corner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`absolute h-7 w-7 border-l-4 border-t-4 border-[#A80D0C] ${className}`}
    />
  );
}

function ResultIcon({ kind }: { kind: string }) {
  const common = {
    className: "h-12 w-12",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 3,
    viewBox: "0 0 24 24",
  } as const;
  if (kind === "check") {
    return (
      <svg {...common}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    );
  }
  if (kind === "x") {
    return (
      <svg {...common}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
      </svg>
    );
  }
  // warn
  return (
    <svg {...common}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
      />
    </svg>
  );
}

function CameraIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
      />
    </svg>
  );
}

function FingerIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.6}
        d="M9 11V6a2 2 0 114 0v5m0 0V4a2 2 0 114 0v7m0 0a2 2 0 114 0v3a8 8 0 01-8 8h-2a8 8 0 01-7-4l-2.5-4.5a2 2 0 013.5-2L9 13"
      />
    </svg>
  );
}

function BatteryIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="2" y="8" width="16" height="8" rx="2" strokeWidth={1.8} />
      <path strokeLinecap="round" strokeWidth={1.8} d="M21 11v2" />
      <path strokeLinecap="round" strokeWidth={1.8} d="M6 10v4" />
    </svg>
  );
}

function SearchIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="11" cy="11" r="7" strokeWidth={1.8} />
      <path strokeLinecap="round" strokeWidth={1.8} d="M21 21l-4.3-4.3" />
    </svg>
  );
}

function InfoIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" strokeWidth={1.8} />
      <path strokeLinecap="round" strokeWidth={1.8} d="M12 11v5m0-8h.01" />
    </svg>
  );
}
