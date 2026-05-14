"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type CSSProperties,
} from "react";
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

type ErrorLike = {
  name?: string;
  message?: string;
};

type AngleStyle = CSSProperties & {
  "--angle": string;
};

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
  const [spinTime, setSpinTime] = useState<number>(2.0);
  const [isLoading, setIsLoading] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<
    "prompt" | "granted" | "denied" | "checking"
  >("prompt");
  const [cameraStarted, setCameraStarted] = useState(false);
  const [liveEvent, setLiveEvent] = useState<LiveEvent>(null);
  const [emailSUNET, setEmailSUNET] = useState<string>("");
  const [isMobile, setIsMobile] = useState(true);
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
    setSpinTime(0.5);
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
      setSpinTime(2.0);
    }
  }, []);

  const handleEmailSubmit = useCallback(async () => {
    if (!emailSUNET.trim()) return;
    if (showConfirmationRef.current) return;

    // Clear any existing timeout
    if (statusTimeoutRef.current) {
      clearTimeout(statusTimeoutRef.current);
      statusTimeoutRef.current = null;
    }

    setStatus(null);
    setTicketInfo(null);
    setIsLoading(true);
    setSpinTime(0.5);
    try {
      // Step 1: GET lookup only (no side effects)
      const response = await fetch(
        `/api/scan?emailSUNET=${encodeURIComponent(emailSUNET.toLowerCase().trim())}&event_id=${encodeURIComponent(liveEvent?.id ?? "")}`,
      );

      const data = (await response.json()) as {
        status?: TicketStatus;
        ticket?: TicketInfo;
      };

      const ticketStatus = data.status ?? "invalid";
      setEmailSUNET("");

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
        }, 10000);
      }
    } catch (error) {
      console.error("Scan error:", error);
      setStatus("invalid");
      setTicketInfo(null);
      setEmailSUNET("");
      await fetchLiveEvent();

      statusTimeoutRef.current = setTimeout(() => {
        setStatus(null);
        setTicketInfo(null);
        statusTimeoutRef.current = null;
      }, 3000);
    } finally {
      setIsLoading(false);
      setSpinTime(2.0);
    }
  }, [emailSUNET, liveEvent?.id]);

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

  // Auto-start camera when permission is granted
  useEffect(() => {
    // If the live event gets turned off while scanning, stop the camera.
    if (!liveEvent) {
      void stopScanner();
    }

    if (
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
  }, [liveEvent, cameraPermission, cameraStarted, startCamera, stopScanner]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (statusTimeoutRef.current) {
        clearTimeout(statusTimeoutRef.current);
      }
    };
  }, []);

  const getStatusText = () => {
    if (status === "scanned") {
      if (ticketInfo?.type?.toLowerCase().trim() === "vip") {
        return "✓ VIP Ticket - Scanned";
      }
      return "✓ Valid Ticket - Scanned";
    }
    if (status === "already_scanned") return "⚠ Already Scanned";
    if (status === "invalid") return "✗ Invalid Ticket";
    if (status === "id_mismatch") return "✗ ID Does Not Match";
    return "Ready to Scan";
  };

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

  // Get background color based on scan status (subtle overlay matching site style)
  const getStatusOverlay = () => {
    if (status === "scanned") {
      if (ticketInfo?.type?.toLowerCase() === "vip") {
        return "bg-teal-600/90";
      }
      return "bg-green-600/90";
    }
    if (status === "already_scanned") {
      return "bg-yellow-600/90";
    }
    if (status === "invalid") {
      return "bg-red-600/90";
    }
    if (status === "id_mismatch") {
      return "bg-red-600/90";
    }
    return "";
  };

  // Get text color - always white when status is set for readability
  const getTextColor = () => {
    return status ? "text-white" : "";
  };

  // Show desktop message if not on mobile
  if (!isMobile) {
    return (
      <div className="flex min-h-screen flex-col items-center font-sans bg-[var(--ssb-paper)]">
        <main className="flex w-full flex-1 justify-center bg-[var(--ssb-paper)] pt-16">
          <section className="w-full max-w-5xl flex flex-col py-6 lg:py-8 px-6 sm:px-12 md:px-16">
            <div className="text-center mb-8">
              <h1 className="text-4xl sm:text-4xl text-[#A80D0C] mb-4 font-serif">
                SSB Scanner
              </h1>
            </div>
            <div className="bg-zinc-900 rounded-xl p-8 sm:p-12 text-center border border-zinc-800">
              <svg
                className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-6 text-zinc-400"
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
              <h2 className="text-2xl sm:text-3xl text-white mb-4 font-serif">
                Please Use Mobile Device
              </h2>
              <p className="text-zinc-300 text-base sm:text-lg mb-2">
                The scanner is optimized for mobile devices.
              </p>
              <p className="text-zinc-400 text-sm sm:text-base">
                Please open this page on your phone or tablet to scan tickets.
              </p>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div
      className={`flex h-screen flex-col items-center font-sans transition-colors duration-500 overflow-hidden ${
        status ? getStatusOverlay() : "bg-[var(--ssb-paper)]"
      }`}
    >
      <main
        className={`flex w-full flex-1 justify-center transition-colors duration-500 pt-6 overflow-y-auto ${
          status ? getStatusOverlay() : "bg-[var(--ssb-paper)]"
        }`}
      >
        <section className="w-full max-w-5xl flex flex-col py-2 sm:py-4 lg:py-6 px-4 sm:px-6 md:px-12 lg:px-16">
          <div className="text-center mb-2 sm:mb-4">
            <h1
              className={`text-4xl mb-1 sm:mb-2 font-serif ${
                status ? getTextColor() : "text-[#A80D0C]"
              }`}
            >
              SSB Scanner
            </h1>
            {liveEvent ? (
              <div className="mt-1 sm:mt-2">
                <p
                  className={`text-md md:text-lg ${
                    status ? getTextColor() : "text-white"
                  }`}
                >
                  Event:{" "}
                  <span
                    className={`text-md font-semibold ${
                      status ? getTextColor() : "text-white"
                    }`}
                  >
                    {liveEvent.name} @
                  </span>
                  {liveEvent.venue && (
                    <>
                      {" "}
                      <span
                        className={`text-md italic font-semibold ${status ? getTextColor() : "text-white"}`}
                      >
                        {liveEvent.venue}
                      </span>
                    </>
                  )}
                </p>
                {liveEvent.scanned !== undefined &&
                  liveEvent.totalSold !== undefined && (
                    <p
                      className={`text-sm mt-1 ${
                        status ? getTextColor() : "text-zinc-300"
                      }`}
                    >
                      Tickets: {liveEvent.scanned} / {liveEvent.totalSold}{" "}
                      scanned
                    </p>
                  )}
              </div>
            ) : (
              <div className="mt-2 sm:mt-4">
                <div
                  className={`text-center p-4 sm:p-6 rounded-xl ${
                    status
                      ? "bg-transparent border-0"
                      : "bg-zinc-900 border border-zinc-800"
                  }`}
                >
                  <p
                    className={`font-semibold mb-2 text-base sm:text-lg ${
                      status ? getTextColor() : "text-yellow-400"
                    }`}
                  >
                    No Live Event
                  </p>
                  <p
                    className={`text-sm sm:text-base ${
                      status ? getTextColor() : "text-zinc-300"
                    }`}
                  >
                    No event is currently live. Scanning is disabled.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Camera Permission Request */}
          {liveEvent && cameraPermission === "prompt" && !cameraStarted && (
            <div className="mb-3 sm:mb-4 text-center">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={startCamera}
                className="inline-flex items-center gap-2 rounded px-6 py-3 text-base sm:text-lg font-semibold text-white bg-[#A80D0C] shadow-lg transition-colors hover:bg-[#C11211] mb-2 touch-manipulation"
              >
                <svg
                  className="w-5 h-5 sm:w-6 sm:h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                Enable Camera
              </motion.button>
              <p
                className={`text-sm sm:text-base ${
                  status ? getTextColor() : "text-zinc-300"
                }`}
              >
                Camera access is required to scan QR codes
              </p>
            </div>
          )}

          {/* Camera Denied Message */}
          {liveEvent && cameraPermission === "denied" && (
            <div
              className={`mb-3 sm:mb-4 text-center p-4 sm:p-6 rounded-xl ${
                status
                  ? "bg-transparent border-0"
                  : "bg-zinc-900 border border-red-500/50"
              }`}
            >
              <p
                className={`font-semibold mb-2 text-base sm:text-lg ${
                  status ? getTextColor() : "text-red-400"
                }`}
              >
                Camera Access Denied
              </p>
              <p
                className={`text-sm sm:text-base mb-3 sm:mb-4 ${
                  status ? getTextColor() : "text-zinc-300"
                }`}
              >
                Please enable camera permissions in your browser settings to
                scan tickets.
              </p>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setCameraPermission("prompt");
                  setCameraError(null);
                }}
                className="inline-flex items-center gap-2 rounded px-6 py-3 text-base sm:text-lg font-semibold text-white bg-[#A80D0C] shadow-lg transition-colors hover:bg-[#C11211] touch-manipulation"
              >
                Try Again
              </motion.button>
            </div>
          )}

          {/* Camera View */}
          {liveEvent && (
            <>
              <style
                dangerouslySetInnerHTML={{
                  __html: `
                #qr-reader__dashboard_section_swaplink,
                #qr-reader__status_span,
                #qr-reader__camera_selection,
                #qr-reader__dashboard_section_csr {
                  display: none !important;
                }
                #qr-reader__dashboard_section {
                  padding: 0 !important;
                  margin: 0 !important;
                }
                #qr-reader__scan_region {
                  border: none !important;
                  box-shadow: none !important;
                }
                #qr-reader__camera_permission_button_id,
                #qr-reader__camera_permission_denied_id {
                  display: none !important;
                }
                video {
                  object-fit: cover !important;
                }
                ${
                  isLoading
                    ? `
                  #qr-reader video {
                    filter: blur(12px) !important;
                  }
                `
                    : ""
                }
                .border-blob-wrapper {
                  position: relative;
                }
                .border-blob-content {
                  position: relative;
                  z-index: 0;
                }
              `,
                }}
              />
              <div className="mb-2 sm:mb-3 shrink-0 relative">
                <div className="w-full max-w-md mx-auto border-blob-wrapper rounded-xl">
                  <motion.div
                    key={spinTime}
                    className="absolute inset-0 rounded-xl pointer-events-none z-1"
                    style={{
                      padding: "6px",
                      background:
                        "conic-gradient(from var(--angle), transparent 0deg, transparent 70deg, rgba(168, 13, 12, 0.55) 90deg, rgba(168, 13, 12, 0.55) 112deg, transparent 130deg, transparent 240deg, #A80D0C 270deg, #A80D0C 300deg, transparent 330deg, transparent 360deg)",
                      WebkitMask:
                        "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                      WebkitMaskComposite: "xor",
                      maskComposite: "exclude",
                      // Animate the gradient angle (not a transform) to avoid loop flicker/snapping.
                      "--angle": "0deg",
                      willChange: "background",
                    } satisfies AngleStyle}
                    animate={{ ["--angle" as const]: "360deg" }}
                    transition={{
                      duration: spinTime,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                  />
                  <div className="border-blob-content">
                    <div
                      id="qr-reader"
                      ref={scanAreaRef}
                      className={`w-full rounded-xl overflow-hidden shadow-2xl bg-zinc-900 h-[280px] sm:h-[350px] md:h-[400px] transition-all duration-300 relative ${
                        isLoading ? "blur-md" : ""
                      }`}
                    />
                    {isLoading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm rounded-xl z-10">
                        <div className="text-center">
                          <div className="inline-flex items-center gap-3 mb-2">
                            <svg
                              className="animate-spin h-8 w-8 text-white"
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
                              ></circle>
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              ></path>
                            </svg>
                          </div>
                          <p className="text-white text-xl sm:text-2xl font-bold">
                            Processing...
                          </p>
                          <p className="text-white/80 text-sm sm:text-base mt-1">
                            Please wait
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                {cameraError && (
                  <p
                    className={`mt-1 text-center text-sm sm:text-base ${
                      status ? getTextColor() : "text-red-400"
                    }`}
                  >
                    {cameraError}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="referral-code-input"
                  type="text"
                  value={emailSUNET}
                  onChange={(e) => {
                    setEmailSUNET(e.target.value);
                  }}
                  placeholder="Enter email or SUNET"
                  className={`w-full min-w-[200px] rounded px-3 py-2 sm:px-4 sm:py-2.5 text-sm sm:text-base text-white bg-white/10 backdrop-blur-sm focus:outline-none  placeholder:text-zinc-200`}
                />
                <motion.button
                  whileHover={isLoading ? {} : { scale: 1.05 }}
                  whileTap={isLoading ? {} : { scale: 0.95 }}
                  onClick={handleEmailSubmit}
                  disabled={isLoading}
                  className="rounded px-4 py-2 text-sm font-semibold text-white bg-[#A80D0C] transition-colors hover:bg-[#C11211] disabled:opacity-50 disabled:cursor-not-allowed w-auto"
                >
                  ✓
                </motion.button>
              </div>
            </>
          )}

          <AnimatePresence mode="wait">
            {status && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={`mt-2 sm:mt-3 p-3 sm:p-4 md:p-6 rounded-xl transition-colors duration-500 shrink-0 bg-transparent cursor-pointer`}
                onClick={() => {
                  if (statusTimeoutRef.current) {
                    clearTimeout(statusTimeoutRef.current);
                    statusTimeoutRef.current = null;
                  }
                  setStatus(null);
                  setTicketInfo(null);
                }}
              >
                <div className="text-center">
                  <h2 className="text-xl sm:text-2xl md:text-3xl mb-2 sm:mb-3 md:mb-4 font-serif text-white">
                    {getStatusText()}
                  </h2>

                  {status === "id_mismatch" && (
                    <p className="text-lg sm:text-xl md:text-2xl font-bold text-white mb-3">
                      Send to Standby Line
                    </p>
                  )}

                  {ticketInfo && (
                    <div className="space-y-1.5 sm:space-y-2 md:space-y-3">
                      {ticketInfo.name && (
                        <p className="text-base sm:text-lg md:text-xl font-semibold text-white">
                          {ticketInfo.name}
                        </p>
                      )}
                      {ticketInfo.email && (
                        <p className="text-sm sm:text-base wrap-break-word">
                          <span className="text-zinc-300">Email:</span>{" "}
                          <span className="font-medium text-white">
                            {ticketInfo.email}
                          </span>
                        </p>
                      )}
                      {ticketInfo.type && (
                        <p className="text-sm sm:text-base">
                          <span className="text-zinc-300">Ticket Type:</span>{" "}
                          <span className="font-medium capitalize text-white">
                            {ticketInfo.type}
                          </span>
                        </p>
                      )}
                      <p className="text-sm sm:text-base break-all">
                        <span className="text-zinc-300">Ticket ID:</span>{" "}
                        <span className="font-mono text-xs sm:text-sm text-white">
                          {ticketInfo.id}
                        </span>
                      </p>
                      {ticketInfo.scan_time && (
                        <p className="text-sm sm:text-base">
                          <span className="text-zinc-300">Scanned at:</span>{" "}
                          <span className="text-white">
                            {formatScanTime(ticketInfo.scan_time)}
                          </span>
                        </p>
                      )}
                      {status === "already_scanned" && ticketInfo.scan_user && (
                        <p className="text-sm sm:text-base">
                          <span className="text-zinc-300">Scanned by:</span>{" "}
                          <span className="font-medium text-white">
                            {ticketInfo.scan_user}
                          </span>
                        </p>
                      )}
                      {status === "already_scanned" &&
                        ticketInfo.scan_email && (
                          <p className="text-sm sm:text-base wrap-break-word">
                            <span className="text-zinc-300">
                              Scanner email:
                            </span>{" "}
                            <span className="font-medium text-white">
                              {ticketInfo.scan_email}
                            </span>
                          </p>
                        )}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ID Verification Confirmation Modal */}
          <AnimatePresence>
            {showConfirmation && pendingTicket && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                onClick={handleCancel}
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.9, opacity: 0, y: 20 }}
                  transition={{ type: "spring", duration: 0.3, bounce: 0.15 }}
                  className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="text-xl text-white mb-1 font-serif text-center">
                    Verify Identity
                  </h3>
                  <p className="text-zinc-400 text-sm text-center mb-4">
                    Does this name match their photo ID?
                  </p>
                  <div className="bg-zinc-800 rounded-xl p-4 mb-5 text-center">
                    <p className="text-2xl font-bold text-white mb-1">
                      {pendingTicket.name || "No name on ticket"}
                    </p>
                    {pendingTicket.email && (
                      <p className="text-sm text-zinc-400 break-all">
                        {pendingTicket.email}
                      </p>
                    )}
                    {pendingTicket.type && (
                      <p className="text-xs text-zinc-500 mt-1 uppercase tracking-wide">
                        {pendingTicket.type} ticket
                      </p>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={handleCancel}
                      disabled={isConfirming}
                      className="flex-1 rounded-xl py-4 text-lg font-semibold text-white bg-zinc-700 border border-zinc-600 transition-colors active:bg-zinc-600 disabled:opacity-50 touch-manipulation"
                    >
                      No
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={handleConfirm}
                      disabled={isConfirming}
                      className="flex-1 rounded-xl py-4 text-lg font-semibold text-white bg-green-600 transition-colors active:bg-green-500 disabled:opacity-50 touch-manipulation"
                    >
                      {isConfirming ? "..." : "Yes"}
                    </motion.button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {!status && liveEvent && (
            <div className="mt-2 sm:mt-3 text-center shrink-0">
              <p
                className={`text-sm sm:text-base ${
                  status ? getTextColor() : "text-zinc-300"
                }`}
              >
                Point camera at QR code to scan
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
