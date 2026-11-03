"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { QrCodeIcon, XMarkIcon } from "@heroicons/react/16/solid";
import { Button } from "@/app/components/ui";

const SCAN_URL = "https://stanfordspeakersbureau.com/scan";

export function ScanQrButton() {
  const [open, setOpen] = useState(false);
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open || dataUrl) return;
    QRCode.toDataURL(SCAN_URL, { width: 512, margin: 2 })
      .then(setDataUrl)
      .catch(() => setDataUrl(null));
  }, [open, dataUrl]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2"
      >
        <QrCodeIcon className="size-4 shrink-0" aria-hidden="true" />
        Scanner QR
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-zinc-900 p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="scan-qr-title"
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              autoFocus
              aria-label="Close"
              className="absolute right-3 top-3 rounded-md p-1.5 text-zinc-400 hover:bg-white/5 hover:text-white"
            >
              <XMarkIcon className="size-4" aria-hidden="true" />
            </button>
            <h2 id="scan-qr-title" className="text-lg font-semibold text-white">
              Scan to open the scanner
            </h2>
            <div className="mt-4 rounded-xl bg-white p-3">
              {dataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={dataUrl}
                  alt={`QR code for ${SCAN_URL}`}
                  className="aspect-square w-full"
                />
              ) : (
                <div className="aspect-square w-full" />
              )}
            </div>
            <a
              href={SCAN_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-3 block break-all text-center text-sm text-zinc-400 hover:text-white"
            >
              {SCAN_URL}
            </a>
          </div>
        </div>
      )}
    </>
  );
}
